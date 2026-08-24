import { alertReasons, sendAlerts as sendAlertsDefault } from "./alerts.js";
import { checkUrl as checkUrlDefault } from "./check.js";
import {
  CHECK_INTERVAL_MINUTES,
  resolvePlan,
  urlLimitForPlan,
} from "./plans.js";
import { parseMonitorInput } from "./validate.js";

const CHECK_CONCURRENCY = 5;

export async function addMonitor(body, persistence, deps = {}) {
  const parsed = parseMonitorInput(body);
  if (parsed.error) {
    return { status: 400, ok: false, error: parsed.error, message: parsed.message };
  }

  let account = await persistence.getAccount(parsed.email);
  if (!account) {
    account = { email: parsed.email, plan: "free", monitorIds: [] };
  }
  account.plan = resolvePlan(parsed.email, account.plan);

  const existing = await findMonitorByUrl(account, parsed.url, persistence);
  if (existing) {
    if (parsed.slackWebhook) {
      existing.slackWebhook = parsed.slackWebhook;
    }
    await persistence.setAccount(account);
    const checked = await runCheckAndMaybeAlert(existing, persistence, deps);
    return {
      status: 200,
      ok: true,
      monitor: publicMonitor(checked, account),
    };
  }

  const limit = urlLimitForPlan(account.plan);
  if (account.monitorIds.length >= limit) {
    return {
      status: 403,
      ok: false,
      error: account.plan === "free" ? "free_cap" : "plan_cap",
      message:
        account.plan === "free"
          ? "Free is 1 URL per email. Founding year ($20 / 12 months) allows 10 URLs."
          : "Founding year allows 10 URLs.",
      plan: account.plan,
      urlCount: account.monitorIds.length,
      urlLimit: limit,
    };
  }

  const now = deps.now?.() ?? new Date();
  const monitor = {
    id: crypto.randomUUID(),
    url: parsed.url,
    email: parsed.email,
    slackWebhook: parsed.slackWebhook,
    createdAt: now.toISOString(),
    lastCheck: null,
    lastAlert: null,
    sslAlertExpiresAt: null,
  };
  account.monitorIds.push(monitor.id);
  await persistence.setMonitor(monitor);
  await persistence.setAccount(account);
  const checked = await runCheckAndMaybeAlert(monitor, persistence, deps);
  return {
    status: 201,
    ok: true,
    monitor: publicMonitor(checked, account),
  };
}

export async function runAllChecks(persistence, deps = {}) {
  const monitors = await persistence.listMonitors();
  const queue = [...monitors];
  const results = [];

  async function worker() {
    while (queue.length) {
      const monitor = queue.shift();
      try {
        const checked = await runCheckAndMaybeAlert(monitor, persistence, deps);
        results.push({
          id: checked.id,
          status: checked.lastCheck?.status ?? null,
        });
      } catch (err) {
        results.push({ id: monitor.id, error: err.message });
      }
    }
  }

  const workerCount = Math.min(CHECK_CONCURRENCY, queue.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return { checked: results.length, results };
}

export async function runCheckAndMaybeAlert(monitor, persistence, deps = {}) {
  const checkUrl = deps.checkUrl ?? checkUrlDefault;
  const sendAlerts = deps.sendAlerts ?? sendAlertsDefault;
  const check = await checkUrl(monitor.url);
  const previousStatus = monitor.lastCheck?.status ?? null;
  const reasons = alertReasons({
    previousStatus,
    check,
    sslAlertExpiresAt: monitor.sslAlertExpiresAt,
  });

  monitor.lastCheck = check;
  if (reasons.length) {
    monitor.lastAlert = await sendAlerts({ monitor, check, reasons });
    if (reasons.includes("ssl") && check.ssl?.expiresAt) {
      monitor.sslAlertExpiresAt = check.ssl.expiresAt;
    }
  }
  await persistence.setMonitor(monitor);
  return monitor;
}

export function publicMonitor(monitor, account) {
  return {
    id: monitor.id,
    url: monitor.url,
    email: monitor.email,
    hasSlack: Boolean(monitor.slackWebhook),
    plan: account.plan,
    urlCount: account.monitorIds.length,
    urlLimit: urlLimitForPlan(account.plan),
    checkIntervalMinutes: CHECK_INTERVAL_MINUTES,
    lastCheck: monitor.lastCheck,
    lastAlert: monitor.lastAlert
      ? {
          at: monitor.lastAlert.at,
          reasons: monitor.lastAlert.reasons,
          email: monitor.lastAlert.email,
          slack: monitor.lastAlert.slack,
        }
      : null,
    badgePath: `/badge/${monitor.id}.svg`,
  };
}

async function findMonitorByUrl(account, url, persistence) {
  for (const id of account.monitorIds) {
    const monitor = await persistence.getMonitor(id);
    if (monitor && monitor.url === url) {
      return monitor;
    }
  }
  return null;
}
