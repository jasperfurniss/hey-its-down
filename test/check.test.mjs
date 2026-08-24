import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { checkUrl, isUpHttpStatus } from "../netlify/lib/check.js";

test("a 200 response is treated as UP", async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  });
  await listen(server);
  const { port } = server.address();
  try {
    const result = await checkUrl(`http://127.0.0.1:${port}/`);
    assert.equal(result.status, "UP");
    assert.equal(result.httpStatus, 200);
    assert.equal(result.error, null);
    assert.equal(isUpHttpStatus(200), true);
  } finally {
    await close(server);
  }
});

test("a connection failure is treated as DOWN", async () => {
  const server = createServer(() => {});
  await listen(server);
  const { port } = server.address();
  await close(server);
  const result = await checkUrl(`http://127.0.0.1:${port}/`);
  assert.equal(result.status, "DOWN");
  assert.equal(result.httpStatus, null);
  assert.ok(result.error);
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
