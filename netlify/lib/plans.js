export const CHECK_INTERVAL_MINUTES = 5;
export const SSL_ALERT_DAYS = 14;
export const FREE_URL_LIMIT = 1;
export const FOUNDING_URL_LIMIT = 10;

export function urlLimitForPlan(plan) {
  switch (plan) {
    case "founding":
      return FOUNDING_URL_LIMIT;
    case "free":
      return FREE_URL_LIMIT;
    default:
      return FREE_URL_LIMIT;
  }
}

export function foundingEmailsFromEnv(env = process.env) {
  return String(env.FOUNDING_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function resolvePlan(email, storedPlan, env = process.env) {
  if (foundingEmailsFromEnv(env).includes(email)) {
    return "founding";
  }
  return storedPlan === "founding" ? "founding" : "free";
}

export function publicConfig(env = process.env) {
  const stripePaymentLink = env.STRIPE_PAYMENT_LINK || null;
  return {
    stripePaymentLink,
    checkoutReady: Boolean(stripePaymentLink),
    checkIntervalMinutes: CHECK_INTERVAL_MINUTES,
    freeUrlLimit: FREE_URL_LIMIT,
    foundingUrlLimit: FOUNDING_URL_LIMIT,
    foundingPrice: "$20 for 12 months",
  };
}
