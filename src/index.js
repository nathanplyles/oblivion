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

// ── YouTube: search + audio stream proxy ──────────────────────────────
// Uses ytdl-core to extract audio-only stream URLs server-side.
// Frontend uses a plain <audio> element — no iframes, no COEP issues.
import ytdl from "@distube/ytdl-core";

// Search YouTube for a video ID by query string
fastify.get("/api/ytSearch", async (request, reply) => {
	try {
		const q = request.query.q || "";
		const url = "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
		const res = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				"Accept-Language": "en-US,en;q=0.9",
			}
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

// Stream audio for a given YouTube video ID directly to the browser
fastify.get("/api/ytAudio/:videoId", async (request, reply) => {
	const { videoId } = request.params;
	if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
		return reply.code(400).send({ error: "invalid videoId" });
	}
	try {
		const videoUrl = "https://www.youtube.com/watch?v=" + videoId;
		// Get info first to set content-length if available
		const info = await ytdl.getInfo(videoUrl);
		const format = ytdl.chooseFormat(info.formats, {
			quality: "highestaudio",
			filter: "audioonly",
		});
		console.log("[ytAudio] streaming", videoId, format.mimeType, format.audioBitrate + "kbps");
		reply
			.header("content-type", format.mimeType || "audio/webm")
			.header("accept-ranges", "bytes")
			.header("cache-control", "no-cache")
			.header("cross-origin-resource-policy", "same-origin");
		const stream = ytdl(videoUrl, { format });
		// Pipe the ytdl stream into the reply
		reply.send(stream);
	} catch (err) {
		console.error("[ytAudio] error for", videoId, err.message);
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
