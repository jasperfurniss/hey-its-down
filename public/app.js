const LAST_MONITOR_KEY = "heyitsdown.lastMonitor";

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function applyFoundingCtas(config) {
  const nodes = document.querySelectorAll("[data-founding-cta]");
  const ready = Boolean(config?.stripePaymentLink);
  for (const node of nodes) {
    if (ready) {
      node.setAttribute("href", config.stripePaymentLink);
      node.textContent = "Get founding year $20";
    } else {
      if (!node.getAttribute("href") || node.getAttribute("href") === "#") {
        node.setAttribute("href", "/app#founding");
      }
      node.textContent = "Founding $20 — checkout coming";
    }
  }
  const checkout = document.querySelector("#checkout");
  if (checkout) {
    checkout.textContent = ready
      ? "Founding checkout uses the configured Stripe Payment Link. Monthly and yearly are still coming later. Paying does not auto-set plan=founding yet."
      : "Stripe checkout is not wired. Founding buttons show “checkout coming”. Set STRIPE_PAYMENT_LINK to show a real pay link. Monthly and yearly stay coming soon.";
  }
}

function renderMonitor(monitor) {
  const result = document.querySelector("#result");
  if (!result || !monitor) return;
  const check = monitor.lastCheck;
  const up = check?.status === "UP";
  const badgeUrl = `${window.location.origin}${monitor.badgePath}`;
  const ssl =
    check?.ssl?.expiresAt != null
      ? `SSL expires ${check.ssl.expiresAt.slice(0, 10)} (${check.ssl.daysRemaining} days)`
      : "No SSL info (HTTP URL, or cert not visible)";
  result.hidden = false;
  result.innerHTML = `
    <div class="status-row">
      <div class="status-pill ${up ? "up" : "down"}">${escapeHtml(check?.status || "NONE")}</div>
      <div class="hint">${escapeHtml(monitor.url)}</div>
    </div>
    <div class="meta">
      <div>HTTP ${check?.httpStatus ?? "—"} · ${check?.responseMs ?? "—"} ms${check?.error ? ` · ${escapeHtml(check.error)}` : ""}</div>
      <div>${escapeHtml(ssl)}</div>
      <div>Plan: ${escapeHtml(monitor.plan)} · ${monitor.urlCount}/${monitor.urlLimit} URLs · checks every ${monitor.checkIntervalMinutes} minutes</div>
      <div>Alerts go to ${escapeHtml(monitor.email)}${monitor.hasSlack ? " and your Slack webhook" : ""}</div>
    </div>
    <div class="badge-box">
      <div>Public badge (no-cache SVG)</div>
      <img alt="status badge" src="${escapeAttr(monitor.badgePath)}?t=${Date.now()}">
      <div class="badge-url">
        <input id="badge-url" readonly value="${escapeAttr(badgeUrl)}">
        <button class="btn btn-ghost" type="button" id="copy-badge">Copy</button>
      </div>
    </div>
  `;
  document.querySelector("#copy-badge")?.addEventListener("click", async () => {
    const input = document.querySelector("#badge-url");
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();
      document.execCommand("copy");
    }
  });
}

function renderError(payload) {
  const result = document.querySelector("#result");
  if (!result) return;
  result.hidden = false;
  const extra =
    payload.error === "free_cap"
      ? `<p class="hint">Upgrade path: founding year is $20 for 12 months (10 URLs). Checkout is stubbed unless a Stripe payment link is configured.</p>`
      : "";
  result.innerHTML = `<p class="error-msg">${escapeHtml(payload.message || "Could not add that monitor.")}</p>${extra}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

async function onSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.querySelector("#submit-btn");
  const result = document.querySelector("#result");
  const data = Object.fromEntries(new FormData(form).entries());
  if (button) button.disabled = true;
  if (result) {
    result.hidden = false;
    result.innerHTML = `<p class="hint">Checking now…</p>`;
  }
  try {
    const res = await fetch("/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: data.url,
        email: data.email,
        slackWebhook: data.slackWebhook,
      }),
    });
    const payload = await res.json();
    if (!payload.ok) {
      renderError(payload);
      return;
    }
    sessionStorage.setItem(LAST_MONITOR_KEY, JSON.stringify(payload.monitor));
    renderMonitor(payload.monitor);
  } catch {
    renderError({ message: "Network error. Try again." });
  } finally {
    if (button) button.disabled = false;
  }
}

const configPromise = loadConfig().then((config) => {
  applyFoundingCtas(config);
  return config;
});

const form = document.querySelector("#monitor-form");
if (form) {
  form.addEventListener("submit", onSubmit);
  try {
    const saved = sessionStorage.getItem(LAST_MONITOR_KEY);
    if (saved) renderMonitor(JSON.parse(saved));
  } catch {
    sessionStorage.removeItem(LAST_MONITOR_KEY);
  }
}

void configPromise;
