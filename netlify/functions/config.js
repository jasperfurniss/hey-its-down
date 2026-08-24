import { publicConfig } from "../lib/plans.js";

export const config = { path: "/api/config" };

export default async (req) => {
  if (req.method !== "GET") {
    return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }
  return Response.json(publicConfig());
};
