import assert from "node:assert/strict";
import { test } from "node:test";
import { alertReasons } from "../netlify/lib/alerts.js";
import { addMonitor } from "../netlify/lib/service.js";
import { createMemoryPersistence } from "../netlify/lib/store-memory.js";

test("alerts on UP to DOWN, not on the first check", () => {
  const check = {
    status: "DOWN",
    ssl: null,
  };
  assert.deepEqual(
    alertReasons({ previousStatus: null, check, sslAlertExpiresAt: null }),
    [],
  );
  assert.deepEqual(
    alertReasons({ previousStatus: "UP", check, sslAlertExpiresAt: null }),
    ["down"],
  );
});

test("free plan rejects a second URL for the same email", async () => {
  const persistence = createMemoryPersistence();
  const deps = {
    checkUrl: async () => ({
      at: new Date().toISOString(),
      status: "UP",
      httpStatus: 200,
      responseMs: 1,
      error: null,
      ssl: null,
    }),
    sendAlerts: async () => ({ at: new Date().toISOString(), reasons: [], email: "skipped", slack: "skipped" }),
  };
  const first = await addMonitor(
    { url: "https://example.com/", email: "a@example.com" },
    persistence,
    deps,
  );
  assert.equal(first.ok, true);
  const second = await addMonitor(
    { url: "https://example.org/", email: "a@example.com" },
    persistence,
    deps,
  );
  assert.equal(second.ok, false);
  assert.equal(second.error, "free_cap");
});
