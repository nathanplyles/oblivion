import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { fileURLToPath } from "url";
import { hostname, tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
const epoxyPath = new URL("../node_modules/@mercuryworkshop/epoxy-transport/dist/", import.meta.url).pathname;
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));
const appRoot = fileURLToPath(new URL("../", import.meta.url));
const oblivionOsPath = fileURLToPath(new URL("../../../oblivionOS/", import.meta.url));
const hasOblivionOs = existsSync(oblivionOsPath) && existsSync(join(oblivionOsPath, "index.html"));
const YT_DLP_ATTEMPT_TIMEOUT_MS = 12000;
const YT_AUDIO_RESOLVE_BUDGET_MS = 15000;
const DOMAIN_ALLOW_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_PUBLIC_IP = "155.248.204.140";
const DOMAIN_ALLOW_TARGET_IPS = new Set(
	String(process.env.ALLOWED_DOMAIN_IPS || process.env.PUBLIC_IP || DEFAULT_PUBLIC_IP)
		.split(/[,\s]+/)
		.map((item) => item.trim())
		.filter(Boolean),
);
const DOMAIN_ALLOW_DENYLIST = new Set(
	String(process.env.ALLOW_DOMAIN_DENYLIST || "")
		.split(/[,\s]+/)
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean),
);
const domainAllowCache = new Map();
const userLocalYtDlpPath = process.env.HOME ? join(process.env.HOME, ".local", "bin", "yt-dlp") : "";

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
	allow_udp_streams: false,
	hostname_blacklist: [/example\.com/],
	dns_servers: ["1.1.1.3", "1.0.0.3"],
});

const sslKeyPath = process.env.SSL_KEY_PATH || "";
const sslCertPath = process.env.SSL_CERT_PATH || "";
const useHttps = Boolean(sslKeyPath && sslCertPath);
let httpsOptions = null;
if (useHttps) {
	try {
		httpsOptions = {
			key: readFileSync(sslKeyPath, "utf8"),
			cert: readFileSync(sslCertPath, "utf8"),
		};
		console.log(`[https] enabled with cert=${sslCertPath} key=${sslKeyPath}`);
	} catch (error) {
		console.error("[https] failed to read SSL cert/key files:", error.message);
		process.exit(1);
	}
}

const fastify = Fastify({
	serverFactory: (handler) => {
		const server = useHttps
			? createHttpsServer(httpsOptions)
			: createHttpServer();
		return server
			.on("request", (req, res) => {
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				if (req.url.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
				else socket.end();
			});
	},
});

fastify.register(fastifyStatic, { root: publicPath, decorateReply: true });
fastify.register(fastifyStatic, { root: scramjetPath, prefix: "/scram/", decorateReply: false });
fastify.register(fastifyStatic, { root: libcurlPath, prefix: "/libcurl/", decorateReply: false });
fastify.register(fastifyStatic, { root: epoxyPath, prefix: "/epoxy/", decorateReply: false });
fastify.register(fastifyStatic, { root: baremuxPath, prefix: "/baremux/", decorateReply: false });
if (hasOblivionOs) {
	fastify.register(fastifyStatic, { root: oblivionOsPath, prefix: "/os/", decorateReply: false });
}

fastify.get("/os", async (_request, reply) => {
	if (!hasOblivionOs) return reply.code(404).send({ error: "oblivionOS not found on server" });
	return reply.redirect("/os/");
});

fastify.get("/os/", async (_request, reply) => {
	if (!hasOblivionOs) return reply.code(404).send({ error: "oblivionOS not found on server" });
	return reply.type("text/html").sendFile("index.html", oblivionOsPath);
});

function normalizeDomainAskValue(raw) {
	if (raw == null) return "";
	let value = String(raw).trim().toLowerCase();
	if (!value) return "";
	if (value.includes("://")) {
		try {
			value = new URL(value).hostname.toLowerCase();
		} catch {
			return "";
		}
	}
	value = value.replace(/\.$/, "");
	if (!value || value === "localhost" || value.endsWith(".local")) return "";
	if (isIP(value)) return "";
	if (value.startsWith("*.")) value = value.slice(2);
	if (value.length > 253 || !value.includes(".")) return "";
	if (!/^[a-z0-9.-]+$/.test(value)) return "";
	const labels = value.split(".");
	if (labels.some((label) => !label || label.length > 63 || label.startsWith("-") || label.endsWith("-"))) return "";
	return value;
}

async function domainResolvesToAllowedIp(domain) {
	const now = Date.now();
	const cached = domainAllowCache.get(domain);
	if (cached && cached.expires > now) return cached.ok;
	let records = [];
	try {
		records = await lookup(domain, { all: true, verbatim: true });
	} catch {
		domainAllowCache.set(domain, { ok: false, expires: now + DOMAIN_ALLOW_CACHE_TTL_MS });
		return false;
	}
	const ok = Array.isArray(records) && records.some((entry) => DOMAIN_ALLOW_TARGET_IPS.has(String(entry?.address || "")));
	domainAllowCache.set(domain, { ok, expires: now + DOMAIN_ALLOW_CACHE_TTL_MS });
	return ok;
}

fastify.get("/api/allow-domain", async (request, reply) => {
	const requested = request.query?.domain || request.query?.host || "";
	const domain = normalizeDomainAskValue(requested);
	reply.header("cache-control", "no-store, max-age=0");
	if (!domain) return reply.code(400).type("text/plain").send("invalid domain");
	if (DOMAIN_ALLOW_DENYLIST.has(domain)) return reply.code(403).type("text/plain").send("domain denied");
	const allowed = await domainResolvesToAllowedIp(domain);
	if (!allowed) return reply.code(403).type("text/plain").send("domain does not resolve to allowed ip");
	return reply.code(200).type("text/plain").send("ok");
});
// â”€â”€ Last.fm proxy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
fastify.get("/api/lastfm", async (request, reply) => {
	const key = process.env.LASTFM_API_KEY;
	if (!key) return reply.code(503).send({ error: "LASTFM_API_KEY not set" });
	try {
		const qs = request.raw.url.slice("/api/lastfm?".length);
		const url = "https://ws.audioscrobbler.com/2.0/?" + qs + "&api_key=" + key + "&format=json";
		const res = await fetch(url);
		const text = await res.text();
		reply.code(res.status).header("content-type", "application/json").send(text);
	} catch (err) {
		reply.code(502).send(JSON.stringify({ error: err.message }));
	}
});

// â”€â”€ iTunes proxy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
fastify.get("/api/itunes", async (request, reply) => {
	try {
		const qs = request.raw.url.slice("/api/itunes?".length);
		const res = await fetch("https://itunes.apple.com/search?" + qs, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
				"Accept": "application/json",
				"Accept-Language": "en-US,en;q=0.9",
			}
		});
		const text = await res.text();
		reply.code(res.status).header("content-type", "application/json").send(text);
	} catch (err) {
		reply.code(502).send(JSON.stringify({ error: err.message }));
	}
});

// â”€â”€ YouTube search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
fastify.get("/api/ytSearch", async (request, reply) => {
	try {
		const q = request.query.q || "";
		const res = await fetch("https://www.youtube.com/results?search_query=" + encodeURIComponent(q), {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
				"Accept-Language": "en-US,en;q=0.9",
			},
			signal: AbortSignal.timeout(8000),
		});
		const html = await res.text();
		const m = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
		reply.send({ videoId: m ? m[1] : null });
	} catch (err) {
		reply.code(502).send({ videoId: null });
	}
});

// â”€â”€ YouTube audio via yt-dlp â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ytUrlCache = new Map();

function resolveYtCookiePath() {
  if (process.env.YT_COOKIES) {
    const tmp = join(tmpdir(), "yt_cookies.txt");
    writeFileSync(tmp, process.env.YT_COOKIES, "utf8");
    console.log("[yt-dlp] cookies from YT_COOKIES env var");
    return tmp;
  }
  const candidates = [
    process.env.COOKIES_PATH,
    join(appRoot, "cookies.txt"),
    join(appRoot, "..", "cookies.txt"),
    join(appRoot, "..", "..", "cookies.txt"),
    fileURLToPath(new URL("../../../cookies.txt", import.meta.url)),
    fileURLToPath(new URL("../../cookies.txt", import.meta.url)),
    "/var/www/oblivion/cookies.txt",
    "/home/ubuntu/cookies.txt",
    "/app/cookies.txt",
    "cookies.txt",
  ].filter(Boolean);
  const cookiePath = candidates.find((candidate) => {
    try {
      return existsSync(candidate);
    } catch {
      return false;
    }
  }) || null;
  console.log(`[yt-dlp] cookies: ${cookiePath || "none"}`);
  return cookiePath;
}

function getYtCookieArgs() {
  const cookiePath = resolveYtCookiePath();
  return cookiePath ? ["--cookies", cookiePath] : [];
}

const ytSharedArgs = [
  "--get-url",
  "--no-playlist",
  "--no-warnings",
  "--js-runtimes",
  "node",
  "--remote-components",
  "ejs:github",
];

const ytAttemptArgs = [
  ["-f", "best", "--extractor-args", "youtube:player_client=tv,web"],
  ["--extractor-args", "youtube:player_client=tv,web"],
  ["-f", "140/251/139", "--extractor-args", "youtube:player_client=android,web"],
  ["-f", "251/250/249/140/139", "--extractor-args", "youtube:player_client=android,web"],
  ["-f", "bestaudio/best", "--extractor-args", "youtube:player_client=android,web"],
  ["-f", "best", "--extractor-args", "youtube:player_client=android,web"],
  ["--extractor-args", "youtube:player_client=android,web"],
  ["--extractor-args", "youtube:player_client=tv,android,web"],
  [],
];

function spawnYtDlp(bin, prefixArgs, videoId, attemptArgs, cookieArgs) {
  return new Promise((resolve, reject) => {
    const args = [
      ...prefixArgs,
      ...attemptArgs,
      ...ytSharedArgs,
      ...cookieArgs,
      `https://www.youtube.com/watch?v=${videoId}`,
    ];
    const proc = spawn(bin, args, { shell: false });
    let out = "";
    let err = "";

    proc.stdout.on("data", (chunk) => {
      out += chunk;
    });
    proc.stderr.on("data", (chunk) => {
      err += chunk;
    });
    proc.on("close", (code) => {
      const url = out.trim().split("\n")[0]?.trim() || "";
      if (code === 0 && url.startsWith("http")) resolve(url);
      else reject(new Error(err.trim().slice(0, 300) || `yt-dlp exit ${code}`));
    });
    proc.on("error", (e) => {
      reject(e);
    });

    setTimeout(() => {
      try {
        proc.kill();
      } catch {}
      reject(new Error("yt-dlp timeout"));
    }, YT_DLP_ATTEMPT_TIMEOUT_MS);
  });
}

function getYtDlpCommandCandidates() {
  return [
    ...(userLocalYtDlpPath && existsSync(userLocalYtDlpPath) ? [{ bin: userLocalYtDlpPath, prefixArgs: [] }] : []),
    { bin: "py", prefixArgs: ["-m", "yt_dlp"] },
    { bin: "yt-dlp", prefixArgs: [] },
    { bin: "python3", prefixArgs: ["-m", "yt_dlp"] },
    { bin: "python", prefixArgs: ["-m", "yt_dlp"] },
  ];
}

function spawnYtDlpAudioStream(bin, prefixArgs, videoId, attemptArgs, cookieArgs) {
  const args = [
    ...prefixArgs,
    ...attemptArgs,
    "--no-playlist",
    "--no-warnings",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    ...cookieArgs,
    "-o",
    "-",
    `https://www.youtube.com/watch?v=${videoId}`,
  ];
  return spawn(bin, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
}

function spawnFfmpegAudioStripper() {
  return spawn("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-i",
    "pipe:0",
    "-vn",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "192k",
    "-f",
    "mp3",
    "pipe:1",
  ], { shell: false, stdio: ["pipe", "pipe", "pipe"] });
}

async function streamYtAudioThroughYtDlp(videoId, reply) {
  const commands = getYtDlpCommandCandidates();
  const configuredCookieArgs = getYtCookieArgs();
  const cookieArgSets = configuredCookieArgs.length ? [configuredCookieArgs, []] : [[]];
  const streamAttemptArgs = [
    ["-f", "best", "--extractor-args", "youtube:player_client=tv,web"],
    ["--extractor-args", "youtube:player_client=tv,web"],
  ];

  let lastErr = null;
  for (const command of commands) {
    for (const cookieArgs of cookieArgSets) {
      for (const attemptArgs of streamAttemptArgs) {
        const ytProc = spawnYtDlpAudioStream(command.bin, command.prefixArgs, videoId, attemptArgs, cookieArgs);
        const ffmpegProc = spawnFfmpegAudioStripper();
        let stderr = "";
        let sent = false;
        let clientClosed = false;

        ytProc.stderr.on("data", (chunk) => {
          stderr += chunk;
        });
        ffmpegProc.stderr.on("data", (chunk) => {
          stderr += chunk;
        });
        ytProc.stdout.on("error", () => {});
        ytProc.stdin?.on?.("error", () => {});
        ffmpegProc.stdin.on("error", () => {});
        ffmpegProc.stdout.on("error", () => {});
        reply.raw.on("error", () => {});
        reply.raw.socket?.on?.("error", () => {});

        ytProc.stdout.pipe(ffmpegProc.stdin);

        const cleanup = () => {
          try { ytProc.kill("SIGKILL"); } catch {}
          try { ffmpegProc.kill("SIGKILL"); } catch {}
        };

        reply.raw.once("close", () => {
          clientClosed = true;
          cleanup();
        });

        try {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("yt-dlp stream timeout")), 20000);
            ffmpegProc.stdout.once("data", (chunk) => {
              clearTimeout(timer);
              sent = true;
              reply
                .code(200)
                .header("content-type", "audio/mpeg")
                .header("cache-control", "no-cache")
                .header("accept-ranges", "none")
                .header("cross-origin-resource-policy", "same-origin");
              ffmpegProc.stdout.unshift(chunk);
              resolve();
            });
            ytProc.on("error", reject);
            ffmpegProc.on("error", reject);
            ytProc.on("close", (code) => {
              if (clientClosed) return;
              if (!sent && code !== 0) reject(new Error(stderr.trim().slice(0, 500) || `yt-dlp exit ${code}`));
            });
            ffmpegProc.on("close", (code) => {
              if (clientClosed) return;
              if (!sent && code !== 0) reject(new Error(stderr.trim().slice(0, 500) || `ffmpeg exit ${code}`));
            });
          });

          return reply.send(ffmpegProc.stdout);
        } catch (err) {
          lastErr = err;
          cleanup();
        }
      }
    }
  }

  throw lastErr || new Error("yt-dlp stream unavailable");
}

async function getYtAudioUrl(videoId) {
  const cached = ytUrlCache.get(videoId);
  if (cached && cached.expires > Date.now()) return cached.url;

  const commands = getYtDlpCommandCandidates();
  const configuredCookieArgs = getYtCookieArgs();
  const cookieArgSets = configuredCookieArgs.length ? [configuredCookieArgs, []] : [[]];

  let lastErr = null;
  const deadline = Date.now() + YT_AUDIO_RESOLVE_BUDGET_MS;
  for (const command of commands) {
    for (const cookieArgs of cookieArgSets) {
      for (const attemptArgs of ytAttemptArgs) {
        if (Date.now() >= deadline) {
          throw lastErr || new Error("yt-dlp resolution timed out");
        }
        try {
          const url = await spawnYtDlp(command.bin, command.prefixArgs, videoId, attemptArgs, cookieArgs);
          ytUrlCache.set(videoId, { url, expires: Date.now() + 4 * 60 * 60 * 1000 });
          return url;
        } catch (err) {
          lastErr = err;
        }
      }
    }
  }

  throw lastErr || new Error("yt-dlp unavailable");
}

fastify.get("/api/ytAudio/:videoId", async (request, reply) => {
  const { videoId } = request.params;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return reply.code(400).send({ error: "invalid videoId" });
  }

  try {
    const cdnUrl = await getYtAudioUrl(videoId);
    const rangeHeader = request.headers.range;
    const baseHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    };
    const requestHeaders = rangeHeader && rangeHeader !== "bytes=0-"
      ? { ...baseHeaders, Range: rangeHeader }
      : baseHeaders;

    let cdnRes = await fetch(cdnUrl, {
      headers: requestHeaders,
      signal: AbortSignal.timeout(30000),
    });

    if ((cdnRes.status === 401 || cdnRes.status === 403) && rangeHeader) {
      cdnRes = await fetch(cdnUrl, {
        headers: baseHeaders,
        signal: AbortSignal.timeout(30000),
      });
    }

    if (!cdnRes.ok && cdnRes.status !== 206) {
      if (cdnRes.status === 401 || cdnRes.status === 403) {
        ytUrlCache.delete(videoId);
        return streamYtAudioThroughYtDlp(videoId, reply);
      }
      ytUrlCache.delete(videoId);
      return reply.code(502).send({ error: `CDN ${cdnRes.status}` });
    }

    const contentType = cdnRes.headers.get("content-type") || "audio/mp4";
    const contentLength = cdnRes.headers.get("content-length");
    const contentRange = cdnRes.headers.get("content-range");

    reply
      .code(cdnRes.status)
      .header("content-type", contentType)
      .header("accept-ranges", "bytes")
      .header("cache-control", "no-cache")
      .header("cross-origin-resource-policy", "same-origin");

    if (contentLength) reply.header("content-length", contentLength);
    if (contentRange) reply.header("content-range", contentRange);
    return reply.send(cdnRes.body);
  } catch (err) {
    try {
      return await streamYtAudioThroughYtDlp(videoId, reply);
    } catch (streamErr) {
      console.error("[ytAudio] error:", streamErr.message || err.message);
      reply.code(502).send({ error: streamErr.message || err.message });
    }
  }
});
fastify.get("/api/ytProxy", async (request, reply) => {
	reply.code(410).send({ error: "deprecated" });
});

// â”€â”€ Image proxy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
fastify.get("/api/img/*", async (request, reply) => {
	try {
		const imgPath = request.raw.url.slice("/api/img/".length);
		const url = "https://" + imgPath;
		const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
		if (!res.ok) return reply.code(res.status).send();
		const ct = res.headers.get("content-type") || "image/jpeg";
		if (!res.body) return reply.code(502).send({ error: "invalid image stream" });
		reply
			.header("content-type", ct)
			.header("cache-control", "public, max-age=86400")
			.header("cross-origin-resource-policy", "cross-origin")
			.send(Readable.fromWeb(res.body));
	} catch (err) {
		reply.code(502).send();
	}
});

// â”€â”€ LRCLIB lyrics proxy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
fastify.get("/api/lyrics", async (request, reply) => {
	try {
		const { track, artist, album, duration } = request.query;
		if (!track) return reply.code(400).send({ error: "track is required" });
		const params = new URLSearchParams({ track_name: track });
		if (artist) params.set("artist_name", artist);
		if (album) params.set("album_name", album);
		if (duration) params.set("duration", duration);
		const res = await fetch("https://lrclib.net/api/get?" + params.toString(), {
			headers: { "User-Agent": "oblivion/1.0 (https://github.com/nathanplyles/oblivion)" },
			signal: AbortSignal.timeout(8000),
		});
		if (res.status === 404) return reply.code(404).send({ error: "not found" });
		const data = await res.json();
		reply.code(res.status).send({
			synced: data.syncedLyrics || null,
			plain: data.plainLyrics || null,
			instrumental: data.instrumental || false,
		});
	} catch (err) {
		reply.code(502).send({ error: err.message });
	}
});

// â”€â”€ AI proxy (Cerebras â†’ Groq â†’ Gemini Flash-Lite fallback chain) â”€â”€â”€â”€â”€â”€
const AI_PROVIDERS = [
	{
		name: "cerebras",
		envKey: "CEREBRAS_API_KEY",
		url: "https://api.cerebras.ai/v1/chat/completions",
		model: "llama3.1-8b",
	},
];

const AI_MAX_MESSAGES = 40;
const AI_MAX_MESSAGE_CHARS = 12000;

function normalizeAIMessages(messages) {
	if (!Array.isArray(messages)) return [];
	return messages
		.slice(-AI_MAX_MESSAGES)
		.map((message) => ({
			role: message?.role === "assistant" ? "assistant" : "user",
			content: String(message?.content ?? "").slice(0, AI_MAX_MESSAGE_CHARS),
		}))
		.filter((message) => message.content.trim().length > 0);
}

function getAIProvidersInOrder(preferredProviderName) {
	if (!preferredProviderName) return AI_PROVIDERS;
	const preferred = AI_PROVIDERS.find((provider) => provider.name === preferredProviderName);
	if (!preferred) return AI_PROVIDERS;
	return [preferred, ...AI_PROVIDERS.filter((provider) => provider.name !== preferredProviderName)];
}

async function tryAIProvider(provider, messages, maxTokens) {
	const key = process.env[provider.envKey];
	if (!key) throw new Error("no key configured");
	const res = await fetch(provider.url, {
		method: "POST",
		headers: {
			"Authorization": "Bearer " + key,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ model: provider.model, messages, max_tokens: maxTokens, stream: false }),
		signal: AbortSignal.timeout(20000),
	});
	if (res.status === 429 || res.status === 503) throw new Error("quota/" + res.status);
	if (!res.ok) {
		const errText = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 240);
		throw new Error("http/" + res.status + (errText ? " " + errText : ""));
	}
	const data = await res.json();
	const content = data?.choices?.[0]?.message?.content;
	if (!content) throw new Error("empty response");
	return { content, provider: provider.name };
}

fastify.post("/api/ai", async (request, reply) => {
	try {
		const body = request.body;
		const messages = normalizeAIMessages(body?.messages);
		if (!messages.length) return reply.code(400).send({ error: "messages required" });
		const maxTokens = Math.min(body.max_tokens || 1024, 4096);
		const preferredProvider = typeof body?.preferred_provider === "string"
			? body.preferred_provider.trim().toLowerCase()
			: "";
		const providersToTry = getAIProvidersInOrder(preferredProvider);
		const configuredProviders = providersToTry.filter((provider) => {
			const value = process.env[provider.envKey];
			return typeof value === "string" && value.trim().length > 0;
		});
		if (!configuredProviders.length) {
			return reply.code(503).send({
				error: "AI is not configured on this server",
				detail: "Set CEREBRAS_API_KEY in .env.local",
			});
		}
		let lastErr;
		for (const provider of configuredProviders) {
			try {
				console.log(`[ai] trying ${provider.name}...`);
				const result = await tryAIProvider(provider, messages, maxTokens);
				console.log(`[ai] success via ${provider.name}`);
				return reply.send({ content: result.content, provider: result.provider });
			} catch (e) {
				console.log(`[ai] ${provider.name} failed: ${e.message}`);
				lastErr = e;
			}
		}
		reply.code(502).send({ error: "all AI providers failed", detail: lastErr?.message });
	} catch (err) {
		reply.code(502).send({ error: err.message });
	}
});

fastify.get("/healthz", async (_request, reply) => {
	return reply.code(200).send({ status: "ok" });
});

fastify.setNotFoundHandler((req, reply) => {
	return reply.code(404).type("text/html").sendFile("404.html");
});

fastify.server.on("listening", () => {
	const address = fastify.server.address();
	const protocol = useHttps ? "https" : "http";
	console.log("Listening on:");
	console.log(`\t${protocol}://localhost:${address.port}`);
	console.log(`\t${protocol}://${hostname()}:${address.port}`);
	console.log(`\t${protocol}://${address.family === "IPv6" ? `[${address.address}]` : address.address}:${address.port}`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
function shutdown() { console.log("SIGTERM signal received: closing HTTP server"); fastify.close(); process.exit(0); }

let port = parseInt(process.env.PORT || "");
if (isNaN(port)) port = 8080;
fastify.listen({ port, host: "0.0.0.0" });

