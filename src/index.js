import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { fileURLToPath } from "url";
import { hostname, tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
const oblivionOsPath = fileURLToPath(new URL("../../../oblivionOS/", import.meta.url));
const hasOblivionOs = existsSync(oblivionOsPath) && existsSync(join(oblivionOsPath, "index.html"));

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
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
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

// ── Last.fm proxy ──────────────────────────────────────────────────────
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

// ── iTunes proxy ───────────────────────────────────────────────────────
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

// ── YouTube search ─────────────────────────────────────────────────────
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

// ── YouTube audio via yt-dlp ───────────────────────────────────────────

const _urlCache = new Map();

const _cookiesPath = (() => {
	if (process.env.YT_COOKIES) {
		const tmp = join(tmpdir(), "yt_cookies.txt");
		writeFileSync(tmp, process.env.YT_COOKIES, "utf8");
		console.log(`[yt-dlp] cookies from YT_COOKIES env var`);
		return tmp;
	}
	const candidates = [
		process.env.COOKIES_PATH,
		fileURLToPath(new URL("../../../cookies.txt", import.meta.url)).replace(/^\/([A-Z]:)/, "$1"),
		"/home/ubuntu/cookies.txt",
		"/var/www/oblivion/cookies.txt",
		"/app/cookies.txt",
		fileURLToPath(new URL("../../cookies.txt", import.meta.url)).replace(/^\/([A-Z]:)/, "$1"),
		"cookies.txt",
	].filter(Boolean);
	const found = candidates.find(p => { try { return existsSync(p); } catch { return false; } }) || null;
	console.log(`[yt-dlp] cookies: ${found || "none"}`);
	return found;
})();

const YT_DLP_ARGS = [
	"-f", "140/251/139",
	"--get-url",
	"--no-playlist",
	"--no-warnings",
	"--js-runtimes", "node",
	...(_cookiesPath ? ["--cookies", _cookiesPath] : []),
];

function trySpawn(cmd, args) {
	return new Promise((resolve, reject) => {
		const proc = spawn(cmd, args, { shell: false });
		let out = "", err = "";
		proc.stdout.on("data", d => out += d);
		proc.stderr.on("data", d => err += d);
		proc.on("close", code => {
			const url = out.trim().split("\n")[0].trim();
			if (code === 0 && url.startsWith("http")) resolve(url);
			else reject(Object.assign(new Error(err.trim().slice(0, 300) || "exit " + code), { isEnoent: false }));
		});
		proc.on("error", e => reject(Object.assign(new Error("ENOENT"), { isEnoent: true })));
		setTimeout(() => { try { proc.kill(); } catch {} reject(new Error("timeout")); }, 60000);
	});
}

async function ytdlpGetUrl(videoId) {
	const cached = _urlCache.get(videoId);
	if (cached && cached.expires > Date.now()) {
		console.log(`[yt-dlp] cache hit for ${videoId}`);
		return cached.url;
	}
	const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
	const cmds = [
		["python3", ["-m", "yt_dlp", ...YT_DLP_ARGS, ytUrl]],
		["yt-dlp", [...YT_DLP_ARGS, ytUrl]],
		["python", ["-m", "yt_dlp", ...YT_DLP_ARGS, ytUrl]],
		["py", ["-m", "yt_dlp", ...YT_DLP_ARGS, ytUrl]],
	];
	let lastErr;
	for (const [cmd, args] of cmds) {
		try {
			console.log(`[yt-dlp] trying: ${cmd}`);
			const url = await trySpawn(cmd, args);
			console.log(`[yt-dlp] ✓ got url`);
			_urlCache.set(videoId, { url, expires: Date.now() + 4 * 60 * 60 * 1000 });
			return url;
		} catch(e) {
			if (e.isEnoent) continue;
			lastErr = e;
			break;
		}
	}
	throw lastErr || new Error("yt-dlp not found");
}

fastify.get("/api/ytAudio/:videoId", async (request, reply) => {
	const { videoId } = request.params;
	if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
		return reply.code(400).send({ error: "invalid videoId" });
	}
	try {
		const cdnUrl = await ytdlpGetUrl(videoId); const mime = "audio/mp4";
		const rangeHeader = request.headers["range"];
		const cdnRes = await fetch(cdnUrl, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
				"Accept": "*/*",
				"Accept-Encoding": "identity",
				"Origin": "https://www.youtube.com",
				"Referer": "https://www.youtube.com/",
				...(rangeHeader ? { "Range": rangeHeader } : {}),
			},
			signal: AbortSignal.timeout(30000),
		});

		if (!cdnRes.ok && cdnRes.status !== 206) {
			// URL may have expired — clear cache and return error
			_urlCache.delete(videoId);
			return reply.code(502).send({ error: "CDN " + cdnRes.status });
		}

		const ct = cdnRes.headers.get("content-type") || mime;
		const cl = cdnRes.headers.get("content-length");
		const cr = cdnRes.headers.get("content-range");
		reply.code(cdnRes.status)
			.header("content-type", ct)
			.header("accept-ranges", "bytes")
			.header("cache-control", "no-cache")
			.header("cross-origin-resource-policy", "same-origin");
		if (cl) reply.header("content-length", cl);
		if (cr) reply.header("content-range", cr);
		return reply.send(cdnRes.body);
	} catch (err) {
		console.error("[ytAudio] error:", err.message);
		reply.code(502).send({ error: err.message });
	}
});

fastify.get("/api/ytProxy", async (request, reply) => {
	reply.code(410).send({ error: "deprecated" });
});

// ── Image proxy ────────────────────────────────────────────────────────
fastify.get("/api/img/*", async (request, reply) => {
	try {
		const imgPath = request.raw.url.slice("/api/img/".length);
		const url = "https://" + imgPath;
		const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
		if (!res.ok) return reply.code(res.status).send();
		const buf = Buffer.from(await res.arrayBuffer());
		const ct = res.headers.get("content-type") || "image/jpeg";
		reply
			.header("content-type", ct)
			.header("cache-control", "public, max-age=86400")
			.header("cross-origin-resource-policy", "cross-origin")
			.send(buf);
	} catch (err) {
		reply.code(502).send();
	}
});

// ── LRCLIB lyrics proxy ────────────────────────────────────────────────
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

// ── AI proxy (Cerebras → Groq → Gemini Flash-Lite fallback chain) ──────
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
