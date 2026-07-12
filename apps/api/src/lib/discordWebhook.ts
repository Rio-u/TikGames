/**
 * Optional mirror of admin activity to a Discord channel via incoming webhook. Unset env var =
 * silent no-op — this integration must never affect the request that triggered it, so every
 * call site fires it without awaiting and every failure is swallowed (logged, not thrown).
 */
export function notifyDiscord(content: string): void {
  const webhookUrl = process.env.DISCORD_ADMIN_LOG_WEBHOOK_URL;
  if (!webhookUrl) return;

  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content.slice(0, 1900) }),
  }).catch((err) => console.error("[api] discord webhook failed:", err));
}
