import { addMonitor } from "../lib/service.js";
import { createPersistence } from "../lib/store.js";

export const config = { path: "/api/monitors" };

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "invalid_json", message: "Body must be JSON." },
      { status: 400 },
    );
  }

  const result = await addMonitor(body, createPersistence());
  const { status, ...payload } = result;
  return Response.json(payload, { status });
};
