import { contextBridge, ipcRenderer } from "electron";

/**
 * The one bridge between the sandboxed renderer (the gate page) and the main process.
 *
 * It exposes exactly four calls and one event — no `ipcRenderer`, no `require`, no Node — so even
 * a fully compromised renderer can do nothing but ask main to register, check status, or enter.
 * Main is the only thing that ever holds the token or reaches the server.
 */
contextBridge.exposeInMainWorld("tikgames", {
  /** Activate this device with the product password. Returns { ok, status } or { ok:false, error }. */
  register: (password: string, label: string) =>
    ipcRenderer.invoke("license:register", { password, label }),
  /** Re-check this machine's licence status (used on gate load to auto-resume an approved device). */
  check: () => ipcRenderer.invoke("license:check") as Promise<string>,
  /** Enter the app — main navigates the window to the dashboard. */
  enter: () => ipcRenderer.invoke("license:enter"),
  /** App version string, for the gate footer. */
  version: () => ipcRenderer.invoke("app:version") as Promise<string>,
  /** Live status pushes from the heartbeat (APPROVED | PENDING | BLOCKED | UNKNOWN | OFFLINE). */
  onStatus: (cb: (status: string) => void) => {
    const handler = (_e: unknown, status: string) => cb(status);
    ipcRenderer.on("license:status", handler);
    return () => ipcRenderer.removeListener("license:status", handler);
  },
});
