import { SSL_ALERT_DAYS } from "./plans.js";

export function alertReasons({ previousStatus, check, sslAlertExpiresAt }) {
  const reasons = [];
  if (previousStatus && previousStatus !== check.status) {
    reasons.push(check.status === "UP" ? "up" : "down");
  }
  const sslExpiring =
    Boolean(check.ssl) &&
    check.ssl.daysRemaining !== null &&
    check.ssl.daysRemaining <= SSL_ALERT_DAYS;
  if (sslExpiring && sslAlertExpiresAt !== check.ssl.expiresAt) {
    reasons.push("ssl");
  }
  return reasons;
}

export function formatAlert({ monitor, check, reasons }) {
  const lines = [
    `Hey it's down: ${reasonLabel(reasons)}`,
    `URL: ${monitor.url}`,
    `Status: ${check.status}`,
  ];
  if (check.httpStatus !== null) {
    lines.push(`HTTP: ${check.httpStatus}`);
  }
  if (check.error) {
    lines.push(`Detail: ${check.error}`);
  }
  if (check.ssl?.expiresAt) {
    lines.push(`SSL expires: ${check.ssl.expiresAt} (${check.ssl.daysRemaining} days)`);
  }
  lines.push(`Checked at: ${check.at}`);
  return lines.join("\n");
}

export function subjectFor(reasons, monitor) {
  return `[Hey it's down] ${reasonLabel(reasons)}: ${monitor.url}`;
}

function reasonLabel(reasons) {
  return reasons
    .map((reason) => {
      switch (reason) {
        case "up":
          return "UP";
        case "down":
          return "DOWN";
        case "ssl":
          return "SSL expiring";
        default: {
          const exhaustive = reason;
          throw new Error(`unknown alert reason: ${exhaustive}`);
        }
      }
    })
    .join(", ");
}

export async function sendAlerts({ monitor, check, reasons }, env = process.env) {
  const recorded = {
    at: check.at,
    reasons,
    email: "skipped",
    slack: "skipped",
  };
  if (reasons.length === 0) {
    return recorded;
  }

  const text = formatAlert({ monitor, check, reasons });
  recorded.email = await sendEmail(monitor.email, subjectFor(reasons, monitor), text, env);
  recorded.slack = await sendSlack(monitor.slackWebhook, text);
  return recorded;
}

async function sendEmail(to, subject, text, env) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.ALERT_FROM_EMAIL;
  if (!apiKey || !from) {
    return "skipped";
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Resend error", res.status, body);
    return "error";
  }
  return "sent";
}

async function sendSlack(webhook, text) {
  if (!webhook) {
    return "skipped";
  }
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error("Slack webhook error", res.status, await res.text());
      return "error";
    }
    return "sent";
  } catch (err) {
    console.error("Slack webhook failed", err);
    return "error";
  }
}
