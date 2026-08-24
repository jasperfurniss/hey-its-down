import { badgeHeaders, badgeSvg } from "../lib/badge.js";
import { createPersistence } from "../lib/store.js";

export const config = { path: "/badge/:id.svg" };

export default async (req, context) => {
  if (req.method !== "GET") {
    return new Response("method not allowed", { status: 405 });
  }

  const id = badgeId(req, context);
  if (!id) {
    return svgResponse(badgeSvg(null), 404);
  }

  const monitor = await createPersistence().getMonitor(id);
  if (!monitor) {
    return svgResponse(badgeSvg(null), 404);
  }

  return svgResponse(badgeSvg(monitor.lastCheck?.status ?? null), 200);
};

function badgeId(req, context) {
  const url = new URL(req.url);
  const fromPath = url.pathname.match(/\/badge\/([^/]+?)(?:\.svg)?$/i);
  const raw = context?.params?.id || fromPath?.[1] || url.searchParams.get("id");
  if (!raw) {
    return null;
  }
  return raw.replace(/\.svg$/i, "");
}

function svgResponse(body, status) {
  return new Response(body, { status, headers: badgeHeaders() });
}
