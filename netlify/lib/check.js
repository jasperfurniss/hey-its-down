import http from "node:http";
import https from "node:https";

const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = "HeyItsDown/1.0 (+https://heyitsdown.com)";

export function isUpHttpStatus(statusCode) {
  return Number.isInteger(statusCode) && statusCode >= 200 && statusCode < 300;
}

export async function checkUrl(urlString, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = options.now ?? new Date();

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return downResult(now, "invalid_url");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return downResult(now, "unsupported_protocol");
  }

  try {
    const { statusCode, cert, responseMs } = await requestOnce(parsed, timeoutMs);
    const status = isUpHttpStatus(statusCode) ? "UP" : "DOWN";
    return {
      at: now.toISOString(),
      status,
      httpStatus: statusCode,
      responseMs,
      error: status === "DOWN" ? `http_${statusCode}` : null,
      ssl: parsed.protocol === "https:" ? sslInfo(cert, now) : null,
    };
  } catch (err) {
    return downResult(now, err?.message || "connection_failed");
  }
}

function downResult(now, error) {
  return {
    at: now.toISOString(),
    status: "DOWN",
    httpStatus: null,
    responseMs: null,
    error,
    ssl: null,
  };
}

function sslInfo(cert, now) {
  if (!cert?.valid_to) {
    return { expiresAt: null, daysRemaining: null };
  }
  const expires = new Date(cert.valid_to);
  if (Number.isNaN(expires.getTime())) {
    return { expiresAt: null, daysRemaining: null };
  }
  const daysRemaining = Math.floor((expires.getTime() - now.getTime()) / 86_400_000);
  return {
    expiresAt: expires.toISOString(),
    daysRemaining,
  };
}

function requestOnce(url, timeoutMs) {
  const lib = url.protocol === "https:" ? https : http;
  const started = Date.now();
  const path = `${url.pathname || "/"}${url.search}`;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path,
        method: "GET",
        timeout: timeoutMs,
        headers: {
          Host: url.host,
          "User-Agent": USER_AGENT,
          Accept: "*/*",
          Connection: "close",
        },
        servername: url.hostname,
      },
      (res) => {
        const responseMs = Date.now() - started;
        let cert = null;
        if (
          url.protocol === "https:" &&
          res.socket &&
          typeof res.socket.getPeerCertificate === "function"
        ) {
          cert = res.socket.getPeerCertificate();
        }
        res.resume();
        resolve({
          statusCode: res.statusCode,
          cert,
          responseMs,
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);
    req.end();
  });
}
