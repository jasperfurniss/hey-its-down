import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addMonitor, runAllChecks } from "../netlify/lib/service.js";
import { publicConfig } from "../netlify/lib/plans.js";
import { badgeHeaders, badgeSvg } from "../netlify/lib/badge.js";
import { createPersistence } from "../netlify/lib/store.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 8888);
const persistence = createPersistence();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (err) {
    console.error(err);
    json(res, 500, { ok: false, error: "server_error" });
  }
});

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

  if (req.method === "GET" && url.pathname === "/api/config") {
    json(res, 200, publicConfig());
    return;
  }

  if (url.pathname === "/api/monitors") {
    if (req.method !== "POST") {
      json(res, 405, { ok: false, error: "method_not_allowed" });
      return;
    }
    const body = await readJson(req);
    if (body === null) {
      json(res, 400, { ok: false, error: "invalid_json", message: "Body must be JSON." });
      return;
    }
    const result = await addMonitor(body, persistence);
    const { status, ...payload } = result;
    json(res, status, payload);
    return;
  }

  if (
    (url.pathname === "/.netlify/functions/scheduled-check" ||
      url.pathname === "/api/run-checks") &&
    (req.method === "POST" || req.method === "GET")
  ) {
    const summary = await runAllChecks(persistence);
    json(res, 200, { ok: true, intervalMinutes: 5, ...summary });
    return;
  }

  const badgeMatch = url.pathname.match(/^\/badge\/([^/]+?)\.svg$/i);
  if (req.method === "GET" && badgeMatch) {
    const monitor = await persistence.getMonitor(badgeMatch[1]);
    const status = monitor?.lastCheck?.status ?? null;
    const body = badgeSvg(status);
    res.writeHead(monitor ? 200 : 404, badgeHeaders());
    res.end(body);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    json(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  await serveStatic(url.pathname, res);
}

async function serveStatic(pathname, res) {
  const aliases = {
    "/": "/index.html",
    "/app": "/app.html",
    "/start": "/app.html",
  };
  const relative = aliases[pathname] || pathname;
  const filePath = path.normalize(path.join(publicDir, relative));
  if (!filePath.startsWith(publicDir)) {
    json(res, 403, { ok: false, error: "forbidden" });
    return;
  }
  try {
    const data = await readFile(filePath);
    const type = TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch {
    json(res, 404, { ok: false, error: "not_found" });
  }
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

server.listen(port, "127.0.0.1", () => {
  console.log(`Hey it's down local server http://127.0.0.1:${port}`);
  console.log("Store: in-memory unless Netlify Blobs context is present.");
});
