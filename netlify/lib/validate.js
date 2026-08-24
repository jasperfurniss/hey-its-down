const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function parseMonitorInput(body) {
  const url = String(body?.url || "").trim();
  const email = normalizeEmail(body?.email);
  const slackWebhook = String(body?.slackWebhook || "").trim() || null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "invalid_url", message: "Enter an http:// or https:// URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "invalid_url", message: "Enter an http:// or https:// URL." };
  }

  if (!EMAIL_RE.test(email)) {
    return { error: "invalid_email", message: "Enter a valid email for alerts." };
  }

  if (slackWebhook) {
    let hook;
    try {
      hook = new URL(slackWebhook);
    } catch {
      return {
        error: "invalid_slack",
        message: "Slack webhook must be a https://hooks.slack.com URL.",
      };
    }
    if (hook.protocol !== "https:" || hook.hostname !== "hooks.slack.com") {
      return {
        error: "invalid_slack",
        message: "Slack webhook must be a https://hooks.slack.com URL.",
      };
    }
  }

  return { url: parsed.toString(), email, slackWebhook };
}
