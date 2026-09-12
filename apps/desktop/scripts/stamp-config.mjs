/**
 * Writes config.json from env before packaging — so a CI/one-liner build can point the exe at the
 * deployed URLs without hand-editing the file:
 *
 *   APP_API_URL=https://tikgames-backend.onrender.com \
 *   APP_DASHBOARD_URL=https://tikgames-dashboard.vercel.app \
 *   pnpm --filter @tikgames/desktop dist
 *
 * If neither env var is set it leaves the existing config.json untouched, so editing it by hand
 * still works exactly as before.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "config.json");

const api = process.env.APP_API_URL;
const dash = process.env.APP_DASHBOARD_URL;

if (!api && !dash) {
  console.log("[stamp-config] no APP_API_URL/APP_DASHBOARD_URL — keeping existing config.json");
  process.exit(0);
}

const current = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : {};
const next = {
  ...current,
  ...(api ? { apiUrl: api } : {}),
  ...(dash ? { dashboardUrl: dash } : {}),
};
writeFileSync(target, JSON.stringify(next, null, 2) + "\n", "utf8");
console.log(`[stamp-config] apiUrl=${next.apiUrl}  dashboardUrl=${next.dashboardUrl}`);
