import crypto from "node:crypto";
import jwt from "jsonwebtoken";

/**
 * Signed device-session tokens for the desktop licence gate.
 *
 * These are a convenience, not the security boundary: the real gate is the per-heartbeat status
 * check against the database, so a stolen token buys nothing once you BLOCK the device — the very
 * next heartbeat comes back BLOCKED and the client locks. The token just saves re-sending the
 * password on every heartbeat.
 */

const LICENSE_SECRET =
  process.env.LICENSE_JWT_SECRET ?? process.env.JWT_ACCESS_SECRET ?? "dev-license-secret-change-me";

export interface LicenseTokenPayload {
  machineHash: string;
}

export function signLicenseToken(machineHash: string): string {
  return jwt.sign({ machineHash }, LICENSE_SECRET, { expiresIn: "7d" });
}

export function verifyLicenseToken(token: string): LicenseTokenPayload | null {
  try {
    const decoded = jwt.verify(token, LICENSE_SECRET) as LicenseTokenPayload;
    return typeof decoded.machineHash === "string" ? { machineHash: decoded.machineHash } : null;
  } catch {
    return null;
  }
}

/**
 * The shared product password check.
 *
 * Fail closed: if `LICENSE_PASSWORD` is unset the server rejects every activation rather than
 * letting the app in with no password at all. Compared over sha256 digests with
 * `timingSafeEqual`, so neither the length nor the content leaks through timing.
 */
export function verifyProductPassword(candidate: unknown): boolean {
  const expected = process.env.LICENSE_PASSWORD;
  if (!expected || typeof candidate !== "string") return false;
  const a = crypto.createHash("sha256").update(candidate).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/** New devices are PENDING and wait for your Discord approval, unless you flip this env on. */
export function autoApproveEnabled(): boolean {
  return process.env.LICENSE_AUTO_APPROVE === "1" || process.env.LICENSE_AUTO_APPROVE === "true";
}

/** Short, human-friendly handle for a machine hash — what you type in Discord (`/approve 3f9a1b02`). */
export function shortId(machineHash: string): string {
  return machineHash.slice(0, 8);
}
