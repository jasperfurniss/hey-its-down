import { getStore } from "@netlify/blobs";
import { createMemoryPersistence } from "./store-memory.js";

const MEMORY_KEY = "__heyItsDownMemoryPersistence";

export { createMemoryPersistence };

export function createPersistence() {
  try {
    const monitors = getStore("monitors");
    const accounts = getStore("accounts");
    return createBlobsPersistence(monitors, accounts);
  } catch (err) {
    const onNetlifyProduction =
      process.env.NETLIFY === "true" && process.env.NETLIFY_DEV !== "true";
    if (onNetlifyProduction) {
      throw err;
    }
    if (!globalThis[MEMORY_KEY]) {
      console.warn(
        "Netlify Blobs unavailable; using in-memory store. Production uses Blobs and this data will not persist.",
      );
      globalThis[MEMORY_KEY] = createMemoryPersistence();
    }
    return globalThis[MEMORY_KEY];
  }
}

function createBlobsPersistence(monitors, accounts) {
  return {
    async getMonitor(id) {
      return (await monitors.get(id, { type: "json" })) ?? null;
    },
    async setMonitor(monitor) {
      await monitors.setJSON(monitor.id, monitor);
    },
    async listMonitors() {
      const out = [];
      let cursor;
      do {
        const page = await monitors.list(cursor ? { cursor } : {});
        for (const blob of page.blobs ?? []) {
          const monitor = await monitors.get(blob.key, { type: "json" });
          if (monitor) {
            out.push(monitor);
          }
        }
        cursor = page.cursor;
      } while (cursor);
      return out;
    },
    async getAccount(email) {
      return (await accounts.get(accountKey(email), { type: "json" })) ?? null;
    },
    async setAccount(account) {
      await accounts.setJSON(accountKey(account.email), account);
    },
  };
}

function accountKey(email) {
  return encodeURIComponent(email);
}
