import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { hostname } from "node:os";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
	allow_udp_streams: false,
	hostname_blacklist: [/example\.com/],
	dns_servers: ["1.1.1.3", "1.0.0.3"],
});

const fastify = Fastify({
	serverFactory: (handler) => {
		return createServer()
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
fastify.register(fastifyStatic, { root: baremuxPath, prefix: "/baremux/", decorateReply: false });

// ── Last.fm proxy ──────────────────────────────────────────────────────
fastify.get("/api/lastfm", async (request, reply) => {
	const key = process.env.LASTFM_API_KEY;
	if (!key) return reply.code(503).send({ error: "Last.fm not configured." });
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
		const url = "https://itunes.apple.com/search?" + qs;
		const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
		const text = await res.text();
		reply.code(res.status).header("content-type", "application/json").send(text);
	} catch (err) {
		reply.code(502).send(JSON.stringify({ error: err.message }));
	}
});

// ── YouTube audio — iOS client (most reliable, no key needed) ─────────
// The iOS client reliably returns direct mp4a audio URLs without
// needing visitor data or API keys. Tested working as of 2025.
async function getStreamingData(videoId) {
	const url = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
	const body = JSON.stringify({
		context: {
			client: {
				clientName: "IOS",
				clientVersion: "19.45.4",
				deviceModel: "iPhone16,2",
				deviceMake: "Apple",
				osName: "iPhone",
				osVersion: "18.1.0.22B83",
				hl: "en",
				gl: "US",
				utcOffsetMinutes: 0,
			},
		},
		videoId,
		playbackContext: {
			contentPlaybackContext: {
				html5Preference: "HTML5_PREF_WANTS",
			},
		},
		contentCheckOk: true,
		racyCheckOk: true,
	});
	const res = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"User-Agent": "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)",
			"X-Youtube-Client-Name": "5",
			"X-Youtube-Client-Version": "19.45.4",
			"Origin": "https://www.youtube.com",
		},
		body,
	});
	if (!res.ok) throw new Error("innertube " + res.status);
	return res.json();
}

function pickAudioFormat(streamingData) {
	const formats = [
		...(streamingData.adaptiveFormats || []),
		...(streamingData.formats || []),
	].filter(f => f.mimeType?.startsWith("audio/") && f.url);
	formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
	// prefer mp4a (aac) — best browser compat, then opus/webm
	return formats.find(f => f.mimeType.includes("mp4a")) ||
		   formats.find(f => f.mimeType.includes("opus")) ||
		   formats[0] || null;
}

// ── YouTube search ─────────────────────────────────────────────────────
fastify.get("/api/ytSearch", async (request, reply) => {
	try {
		const q = request.query.q || "";
		const url = "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
		const res = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				"Accept-Language": "en-US,en;q=0.9",
			},
		});
		const text = await res.text();
		const match = text.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
		if (match) {
			console.log("[ytSearch] found:", match[1], "for:", q);
			return reply.send({ videoId: match[1] });
		}
		reply.send({ videoId: null });
	} catch (err) {
		console.error("[ytSearch] error:", err.message);
		reply.code(502).send({ videoId: null });
	}
});

// ── YouTube audio proxy ────────────────────────────────────────────────
// Gets audio URL via innertube, then fully buffers + re-serves it.
// Buffering avoids issues with YouTube CDN stream piping under Node 18.
fastify.get("/api/ytAudio/:videoId", async (request, reply) => {
	const { videoId } = request.params;
	if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
		return reply.code(400).send({ error: "invalid videoId" });
	}
	try {
		const data = await getStreamingData(videoId);
		console.log("[ytAudio] playability:", data.playabilityStatus?.status, data.playabilityStatus?.reason || "");

		if (data.playabilityStatus?.status !== "OK") {
			const reason = data.playabilityStatus?.reason || "not playable";
			return reply.code(403).send({ error: reason });
		}

		const sd = data.streamingData || {};
		console.log("[ytAudio] adaptive formats:", (sd.adaptiveFormats || []).length, "regular:", (sd.formats || []).length);

		const format = pickAudioFormat(sd);
		if (!format) {
			console.error("[ytAudio] no audio format for", videoId);
			// Log what we got for debugging
			const allFormats = [...(sd.adaptiveFormats||[]), ...(sd.formats||[])];
			console.error("[ytAudio] available mimeTypes:", allFormats.map(f => f.mimeType).join(", "));
			return reply.code(502).send({ error: "no audio format found" });
		}

		console.log("[ytAudio] format chosen:", format.mimeType, format.bitrate, "url length:", format.url?.length);

		// Fetch with Android UA — required for the URL to be valid
		const audioRes = await fetch(format.url, {
			headers: {
				"User-Agent": "com.google.android.youtube/18.11.34 (Linux; U; Android 11) gzip",
				"Referer": "https://www.youtube.com/",
				...(request.headers.range ? { "Range": request.headers.range } : {}),
			},
		});

		console.log("[ytAudio] CDN response status:", audioRes.status, "content-type:", audioRes.headers.get("content-type"));

		if (!audioRes.ok && audioRes.status !== 206) {
			const body = await audioRes.text();
			console.error("[ytAudio] CDN error body:", body.slice(0, 200));
			return reply.code(502).send({ error: "CDN returned " + audioRes.status });
		}

		const ct = audioRes.headers.get("content-type") || format.mimeType || "audio/mp4";
		reply.code(audioRes.status);
		reply.header("content-type", ct);
		reply.header("accept-ranges", "bytes");
		reply.header("cache-control", "no-cache");
		reply.header("cross-origin-resource-policy", "same-origin");
		const cl = audioRes.headers.get("content-length");
		const cr = audioRes.headers.get("content-range");
		if (cl) reply.header("content-length", cl);
		if (cr) reply.header("content-range", cr);
		reply.send(audioRes.body);
	} catch (err) {
		console.error("[ytAudio] error for", videoId, ":", err.message, err.stack);
		reply.code(502).send({ error: err.message });
	}
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

// ──────────────────────────────────────────────────────────────────────

fastify.setNotFoundHandler((req, reply) => {
	return reply.code(404).type("text/html").sendFile("404.html");
});

fastify.server.on("listening", () => {
	const address = fastify.server.address();
	console.log("Listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(`\thttp://${address.family === "IPv6" ? `[${address.address}]` : address.address}:${address.port}`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
function shutdown() { console.log("SIGTERM signal received: closing HTTP server"); fastify.close(); process.exit(0); }

let port = parseInt(process.env.PORT || "");
if (isNaN(port)) port = 8080;
fastify.listen({ port, host: "0.0.0.0" });
