import { Router, type Request } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { notifyDiscord } from "../lib/discordWebhook.js";
import {
  autoApproveEnabled,
  shortId,
  signLicenseToken,
  verifyLicenseToken,
  verifyProductPassword,
} from "../lib/licenseToken.js";
import { prisma } from "../lib/prisma.js";

/**
 * The desktop app's licence gate.
 *
 * A device activates with the shared product password, is fingerprinted, and lands PENDING. It
 * then polls `/heartbeat` and stays locked until you APPROVE it from Discord; BLOCKED is the
 * remote kill switch and takes effect within one heartbeat.
 *
 * Nothing here reads the user's files or machine beyond the identity attributes the app sends
 * (hostname, OS username, a hardware hash) — that is the whole point of a device licence, and the
 * activation screen tells the user it is collected.
 */

const router = Router();

/** The client's real IP, honouring one proxy hop (Render/Vercel put it in x-forwarded-for). */
function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.ip ?? "";
}

interface DeviceInfo {
  machineHash?: unknown;
  hostname?: unknown;
  osUser?: unknown;
  platform?: unknown;
  appVersion?: unknown;
}

function cleanStr(v: unknown, max: number): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= max ? v : null;
}

async function audit(type: string, machineHash: string | null, ip: string, detail?: unknown): Promise<void> {
  await prisma.licenseAuditEvent
    .create({ data: { type, machineHash, ip, detail: (detail as object) ?? undefined } })
    .catch(() => {});
}

/**
 * POST /licensing/register
 * Body: { password, label?, device: { machineHash, hostname, osUser, platform, appVersion } }
 *
 * Idempotent per machine: registering an already-known device returns its current status rather
 * than creating a duplicate, so re-opening the app just resumes where it left off.
 */
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const ip = clientIp(req);
    const { password, label, device } = (req.body ?? {}) as {
      password?: unknown;
      label?: unknown;
      device?: DeviceInfo;
    };

    const machineHash = cleanStr(device?.machineHash, 128);
    if (!machineHash) {
      res.status(400).json({ error: "device.machineHash is required" });
      return;
    }

    if (!verifyProductPassword(password)) {
      await audit("register-denied", machineHash, ip, { reason: "bad-password" });
      // 403, not 401: the request was well-formed, the password was simply wrong. A generic
      // message so a wrong guess learns nothing about how close it was.
      res.status(403).json({ error: "الباسورد غلط" });
      return;
    }

    const info = {
      hostname: cleanStr(device?.hostname, 200),
      osUser: cleanStr(device?.osUser, 200),
      platform: cleanStr(device?.platform, 32),
      appVersion: cleanStr(device?.appVersion, 32),
      label: cleanStr(label, 120),
      lastIp: ip,
      lastSeenAt: new Date(),
    };

    const existing = await prisma.licenseDevice.findUnique({ where: { machineHash } });

    if (existing) {
      // A blocked device that comes back stays blocked — re-registering is not a way around a kill.
      const updated = await prisma.licenseDevice.update({
        where: { machineHash },
        data: existing.status === "BLOCKED" ? { lastIp: ip, lastSeenAt: new Date() } : info,
      });
      await audit("register-existing", machineHash, ip, { status: updated.status });
      res.json({ status: updated.status, token: signLicenseToken(machineHash), shortId: shortId(machineHash) });
      return;
    }

    const status = autoApproveEnabled() ? "APPROVED" : "PENDING";
    const created = await prisma.licenseDevice.create({
      data: {
        machineHash,
        status,
        ...info,
        ...(status === "APPROVED" ? { approvedBy: "auto", approvedAt: new Date() } : {}),
      },
    });
    await audit("register", machineHash, ip, { status, hostname: info.hostname, osUser: info.osUser });

    // Tell you a new machine wants in, with the exact command to let it. Fire-and-forget.
    notifyDiscord(
      status === "PENDING"
        ? [
            "🖥️ **جهاز جديد طالب تفعيل**",
            `• الاسم: ${info.label ?? "—"}`,
            `• الكمبيوتر: ${info.hostname ?? "—"} (${info.osUser ?? "—"})`,
            `• النظام: ${info.platform ?? "—"}  |  IP: ${ip || "—"}`,
            `• المعرّف: \`${shortId(machineHash)}\``,
            `اقبله بـ \`/approve ${shortId(machineHash)}\` أو ارفضه بـ \`/block ${shortId(machineHash)}\``,
          ].join("\n")
        : `✅ جهاز جديد اتفعّل تلقائياً: \`${shortId(machineHash)}\` (${info.hostname ?? "—"})`,
    );

    res.status(201).json({ status: created.status, token: signLicenseToken(machineHash), shortId: shortId(machineHash) });
  }),
);

/**
 * POST /licensing/heartbeat
 * Auth: Bearer licence token (falls back to body.machineHash).
 *
 * The live gate. Returns the device's current status every poll, so an approve or a kill from
 * Discord reaches the client within one interval. Updates lastSeen/IP so your device list shows
 * who is actually online.
 */
router.post(
  "/heartbeat",
  asyncHandler(async (req, res) => {
    const ip = clientIp(req);
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const fromToken = bearer ? verifyLicenseToken(bearer)?.machineHash : null;
    const machineHash = fromToken ?? cleanStr((req.body ?? {}).machineHash, 128);

    if (!machineHash) {
      res.status(400).json({ error: "machineHash required" });
      return;
    }

    const device = await prisma.licenseDevice.findUnique({ where: { machineHash } });
    if (!device) {
      // Unknown machine (server wiped, or a token from a deleted device): tell the client to
      // send the user back to the activation screen rather than leaving it in limbo.
      res.json({ status: "UNKNOWN" });
      return;
    }

    await prisma.licenseDevice.update({
      where: { machineHash },
      data: { lastSeenAt: new Date(), lastIp: ip },
    });

    if (device.status === "BLOCKED") {
      await audit("heartbeat-blocked", machineHash, ip);
    }

    res.json({ status: device.status, blockReason: device.status === "BLOCKED" ? device.blockReason : undefined });
  }),
);

export default router;
