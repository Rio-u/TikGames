import { app, BrowserWindow, ipcMain, shell } from "electron";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * TikGames desktop — the Electron shell.
 *
 * What this process owns, and why it owns it here rather than in the renderer:
 *   - the machine fingerprint (below), which must be computed in Node, not the browser;
 *   - all licensing traffic to the API — the renderer never holds the token or talks to the
 *     server directly, so a tampered page cannot forge an "approved" state;
 *   - the heartbeat loop that is the live kill switch: every poll re-checks status with the
 *     server, and the moment it comes back BLOCKED/UNKNOWN the window is thrown back to the gate.
 *
 * There are no secrets in this file. The product password is typed by the user and sent to the
 * server to verify; the Discord bot token exists only on the server. Anyone who unpacks the exe
 * finds a thin client and an API URL — which is the point.
 */

// --- configuration ------------------------------------------------------------------
//
// Resolved from, in order: a config.json bundled next to the app (so you can repoint a shipped
// build without recompiling), then env (for `pnpm dev`), then localhost defaults.
interface AppConfig {
  apiUrl: string;
  dashboardUrl: string;
}

function loadConfig(): AppConfig {
  const defaults: AppConfig = {
    apiUrl: process.env.APP_API_URL ?? "http://localhost:4000",
    dashboardUrl: process.env.APP_DASHBOARD_URL ?? "http://localhost:5173",
  };
  for (const candidate of [
    path.join(resourcesPath(), "config.json"),
    path.join(app.getAppPath(), "config.json"),
    path.join(__dirname, "..", "config.json"),
  ]) {
    try {
      if (fs.existsSync(candidate)) {
        const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
        return { apiUrl: parsed.apiUrl ?? defaults.apiUrl, dashboardUrl: parsed.dashboardUrl ?? defaults.dashboardUrl };
      }
    } catch {
      /* fall through to defaults */
    }
  }
  return defaults;
}

/** Electron adds `resourcesPath` to `process` at runtime; @types/node doesn't know about it. */
function resourcesPath(): string {
  return (process as unknown as { resourcesPath?: string }).resourcesPath ?? "";
}

const CONFIG = loadConfig();
// 30s in production; override with APP_HEARTBEAT_MS (clamped to 3–120s) for a snappier approve
// or for tests. This is only how fast an approve/kill reaches the client — the gate itself is
// unaffected.
const HEARTBEAT_MS = Math.min(
  120_000,
  Math.max(3_000, Number(process.env.APP_HEARTBEAT_MS) || 30_000),
);

// --- machine identity ---------------------------------------------------------------
//
// A stable id for this physical machine, so the same laptop is recognised across restarts and a
// new laptop shows up as a new device for you to approve. We hash the attributes rather than send
// them raw: the server stores only the digest, never the MAC or serials themselves.
function firstMac(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets).sort()) {
    for (const net of nets[name] ?? []) {
      if (!net.internal && net.mac && net.mac !== "00:00:00:00:00:00") return net.mac;
    }
  }
  return "no-mac";
}

function machineHash(): string {
  const cpu = os.cpus()[0]?.model ?? "cpu";
  const raw = [os.hostname(), os.userInfo().username, firstMac(), cpu, os.platform(), os.arch()].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function deviceInfo() {
  return {
    machineHash: machineHash(),
    hostname: os.hostname(),
    osUser: os.userInfo().username,
    platform: os.platform(),
    appVersion: app.getVersion(),
  };
}

// --- token persistence --------------------------------------------------------------
//
// The device session token lives in userData, not the app bundle. It is a convenience only — the
// heartbeat re-verifies with the server regardless, so a copied token is worthless once blocked.
const tokenFile = () => path.join(app.getPath("userData"), "license.json");

function readToken(): string | null {
  try {
    return JSON.parse(fs.readFileSync(tokenFile(), "utf8")).token ?? null;
  } catch {
    return null;
  }
}

function writeToken(token: string): void {
  try {
    fs.writeFileSync(tokenFile(), JSON.stringify({ token }), "utf8");
  } catch {
    /* non-fatal: we just re-register next launch */
  }
}

function clearToken(): void {
  try {
    fs.unlinkSync(tokenFile());
  } catch {
    /* already gone */
  }
}

// --- licensing API calls ------------------------------------------------------------

async function apiRegister(password: string, label: string) {
  const res = await fetch(`${CONFIG.apiUrl}/licensing/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, label, device: deviceInfo() }),
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string; token?: string; error?: string };
  if (!res.ok) return { ok: false as const, error: data.error ?? `فشل التفعيل (${res.status})` };
  if (data.token) writeToken(data.token);
  return { ok: true as const, status: data.status ?? "PENDING", shortId: (data as { shortId?: string }).shortId };
}

async function apiHeartbeat(): Promise<string> {
  try {
    const token = readToken();
    const res = await fetch(`${CONFIG.apiUrl}/licensing/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ machineHash: machineHash() }),
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string };
    return data.status ?? "OFFLINE";
  } catch {
    // Network down ≠ blocked. Report OFFLINE so the client keeps the last good state and retries,
    // rather than locking a paying user out because their wifi hiccuped.
    return "OFFLINE";
  }
}

// --- window -------------------------------------------------------------------------

let win: BrowserWindow | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let onDashboard = false;

function gatePath(): string {
  return path.join(__dirname, "..", "renderer", "gate.html");
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#08060f",
    show: false,
    autoHideMenuBar: true,
    title: "TikGames",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The dashboard is a trusted first-party origin we control; still, keep the renderer walled
      // off from Node and only let it reach the app through the narrow preload bridge.
    },
  });

  win.once("ready-to-show", () => win?.show());
  void win.loadFile(gatePath());

  // Navigation lockdown: the window may only ever be the local gate or the dashboard origin.
  // Anything else (an ad iframe trying to bust out, a phished link) is refused, and genuine
  // external links open in the user's real browser instead of inside the app.
  const dashboardOrigin = safeOrigin(CONFIG.dashboardUrl);
  win.webContents.on("will-navigate", (e, url) => {
    if (!isAllowed(url, dashboardOrigin)) {
      e.preventDefault();
      if (/^https?:/.test(url)) void shell.openExternal(url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("closed", () => {
    win = null;
  });
}

function safeOrigin(u: string): string {
  try {
    return new URL(u).origin;
  } catch {
    return "";
  }
}

function isAllowed(url: string, dashboardOrigin: string): boolean {
  if (url.startsWith("file://")) return true;
  return dashboardOrigin !== "" && safeOrigin(url) === dashboardOrigin;
}

/** Enter the app: load the dashboard and start guarding it. */
function enterDashboard(): void {
  if (!win) return;
  onDashboard = true;
  void win.loadURL(CONFIG.dashboardUrl);
}

/** Kicked back to the gate — access pending, revoked, or the server forgot us. */
function returnToGate(reason: "blocked" | "pending" | "unknown"): void {
  if (!win) return;
  onDashboard = false;
  if (reason !== "pending") clearToken();
  void win.loadFile(gatePath(), { query: { locked: reason } });
}

/**
 * The heartbeat is the live gate. It runs for the whole life of the app, on the dashboard as well
 * as the gate, so a `/block` in Discord pulls the user out mid-session within one interval.
 */
function startHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(async () => {
    const status = await apiHeartbeat();
    win?.webContents.send("license:status", status);
    if (onDashboard && (status === "BLOCKED" || status === "UNKNOWN" || status === "PENDING")) {
      returnToGate(status === "BLOCKED" ? "blocked" : status === "PENDING" ? "pending" : "unknown");
    }
  }, HEARTBEAT_MS);
}

// --- IPC (the renderer's only door to the server) -----------------------------------

ipcMain.handle("license:register", async (_e, args: { password: string; label: string }) => {
  const result = await apiRegister(args.password ?? "", args.label ?? "");
  if (result.ok) startHeartbeat();
  return result;
});

ipcMain.handle("license:check", async () => {
  // Called by the gate on load: if this machine is already approved, skip straight in.
  const status = await apiHeartbeat();
  if (status !== "OFFLINE") startHeartbeat();
  return status;
});

ipcMain.handle("license:enter", () => {
  enterDashboard();
});

ipcMain.handle("app:version", () => app.getVersion());

// --- lifecycle ----------------------------------------------------------------------

// One instance only: a second launch focuses the existing window instead of opening a rival that
// would fight over the same licence and heartbeat.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (process.platform !== "darwin") app.quit();
  });
}
