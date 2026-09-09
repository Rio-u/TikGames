/**
 * Seeds a ready-to-play install: the two standing accounts, plus every asset sitting in
 * `seed-assets/` at the repo root.
 *
 * Run by `setup.bat` on a fresh machine, but safe to run by hand at any time:
 *
 *   node apps/api/seed.mjs
 *
 * Idempotent on both halves — accounts are upserted by email, assets are matched by the
 * filename already stored in the DB — so re-running only adds what's genuinely new and never
 * duplicates a background or resets a password that's since been changed... except when
 * SEED_RESET_PASSWORDS=1, which forces the two seeded passwords back to the documented default.
 *
 * Why assets live in `seed-assets/` and not straight in `apps/api/uploads/`: uploads/ is
 * gitignored runtime state (the admin page writes into it), so it never reaches a clone. This
 * copies the tracked pool into it on first run, which is what makes Trivia and Speed Word
 * actually startable on a machine nobody has uploaded anything on — both return a 400 when
 * their pool is empty (see POST /games/session/start).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../../packages/database/generated/client/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const SEED_ASSETS = path.join(REPO_ROOT, "seed-assets");
const UPLOAD_ROOT = path.join(HERE, "uploads");

// The URL column stores an absolute URL because that's what the admin upload route writes
// (`${req.protocol}://${req.get("host")}/uploads/...`). Both the overlay and the dashboard load
// these cross-origin, so a relative path would break the overlay — keep them absolute and make
// the host configurable for a deployed install.
const PUBLIC_API_URL = (process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`).replace(/\/$/, "");
const RESET_PASSWORDS = process.env.SEED_RESET_PASSWORDS === "1";

const prisma = new PrismaClient();

const ACCOUNTS = [
  {
    email: "d7@tikgames.local",
    username: "d7",
    displayName: "d7",
    password: "123456789",
    role: "ADMIN",
  },
  {
    email: "nfnf@tikgames.local",
    username: "nfnf",
    displayName: "nfnf",
    password: "123456789",
    role: "STREAMER",
  },
];

// "Permanent" is just ACTIVE: POST /games/session/start blocks SUSPENDED outright and blocks
// TRIAL once trialGamesUsed hits trialGamesLimit, but ACTIVE is unlimited and — verified against
// the whole api — nothing anywhere expires it, currentPeriodEnd included. The far-future dates
// below only exist so the account page renders a sane figure instead of an elapsed one.
const FAR_FUTURE = new Date("2099-12-31T00:00:00.000Z");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const AUDIO_EXT = new Set([".mp3", ".ogg", ".wav", ".m4a"]);

/** trivia-backgrounds -> { model, urlDir, allowed } */
const ASSET_POOLS = [
  { dir: "trivia-backgrounds", model: "triviaBackgroundImage", label: "خلفيات تريفيا", allowed: IMAGE_EXT },
  { dir: "speed-word-backgrounds", model: "speedWordBackgroundImage", label: "خلفيات سرعة الكلمة", allowed: IMAGE_EXT },
  { dir: "musical-chairs-music", model: "musicalChairsTrack", label: "موسيقى الكراسي", allowed: AUDIO_EXT },
];

async function seedAccount({ email, username, displayName, password, role }) {
  const existing = await prisma.user.findUnique({ where: { email }, include: { subscription: true } });
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    // Never silently clobber a live account's password on a re-run — only role/handle are
    // re-asserted, since those are what make the seed meaningful (admin stays admin).
    update: { username, displayName, role, ...(RESET_PASSWORDS || !existing?.passwordHash ? { passwordHash } : {}) },
    create: { email, username, displayName, role, passwordHash },
  });

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: { status: "ACTIVE", currentPeriodEnd: FAR_FUTURE, activatedAt: new Date() },
    create: {
      userId: user.id,
      status: "ACTIVE",
      trialEndsAt: FAR_FUTURE,
      currentPeriodEnd: FAR_FUTURE,
      activatedAt: new Date(),
      trialGamesLimit: 999999,
    },
  });

  console.log(`  ${existing ? "حدّثت" : "أنشأت"} ${role === "ADMIN" ? "الأدمن" : "الحساب"} ${email} (اشتراك دائم ACTIVE)`);
  return user;
}

async function seedPool({ dir, model, label, allowed }, uploaderId) {
  const srcDir = path.join(SEED_ASSETS, dir);
  if (!fs.existsSync(srcDir)) return { added: 0, total: 0 };

  const files = fs
    .readdirSync(srcDir)
    .filter((f) => allowed.has(path.extname(f).toLowerCase()))
    .sort();

  const destDir = path.join(UPLOAD_ROOT, dir);
  fs.mkdirSync(destDir, { recursive: true });

  // Match on the filename rather than the whole URL: a row seeded under a different host (a
  // deploy, or a colleague's machine) is still the same asset and must not be duplicated.
  const rows = await prisma[model].findMany({ select: { id: true, url: true } });
  const known = new Set(rows.map((r) => path.basename(r.url)));

  let added = 0;
  for (const file of files) {
    const dest = path.join(destDir, file);
    if (!fs.existsSync(dest)) fs.copyFileSync(path.join(srcDir, file), dest);
    if (known.has(file)) continue;
    await prisma[model].create({
      data: { url: `${PUBLIC_API_URL}/uploads/${dir}/${encodeURIComponent(file)}`, uploadedById: uploaderId },
    });
    added += 1;
  }

  const total = await prisma[model].count();
  console.log(`  ${label}: ${files.length} ملف في seed-assets، ضفت ${added} جديد، الإجمالي في الداتابيز ${total}`);
  return { added, total };
}

console.log("[seed] الحسابات:");
const created = [];
for (const account of ACCOUNTS) created.push(await seedAccount(account));
// Assets are attributed to the admin — the same account the admin page would upload them as.
const admin = created.find((u) => u.role === "ADMIN") ?? created[0];

console.log("[seed] الأصول (من seed-assets/ -> apps/api/uploads/):");
const results = [];
for (const pool of ASSET_POOLS) results.push({ pool, ...(await seedPool(pool, admin.id)) });

// Trivia and Speed Word hard-fail at session start on an empty pool, so an install that seeds
// zero of either is broken in a way that only shows up later, as a 400 mid-stream. Say so now.
const blockers = results.filter((r) => r.pool.allowed === IMAGE_EXT && r.total === 0);
if (blockers.length > 0) {
  console.log("");
  console.log("[seed] ⚠️  تحذير — الفولدرات دي فاضية، واللعبة اللي بتعتمد عليها مش هتبدأ:");
  for (const b of blockers) console.log(`         seed-assets/${b.pool.dir}/  (${b.pool.label})`);
  console.log("         حط فيها صور واعِد تشغيل: node apps/api/seed.mjs");
}

console.log("");
console.log("[seed] خلص. تدخل بالإيميل (مش باليوزرنيم):");
console.log("         أدمن   : d7@tikgames.local    / 123456789   -> لوحة الأدمن على /d7admind7");
console.log("         الحساب : nfnf@tikgames.local  / 123456789");
await prisma.$disconnect();
