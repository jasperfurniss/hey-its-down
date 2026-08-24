import { runAllChecks } from "../lib/service.js";
import { createPersistence } from "../lib/store.js";

export const config = { schedule: "*/5 * * * *" };

export default async () => {
  const summary = await runAllChecks(createPersistence());
  return Response.json({ ok: true, intervalMinutes: 5, ...summary });
};
