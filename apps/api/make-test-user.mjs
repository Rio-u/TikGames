/**
 * Creates (or refreshes) a single reusable local test account and prints an access token.
 *
 * Verification scripts used to register a fresh account over HTTP on every run, which is exactly
 * what `registerLimiter` (10 per hour, by design) exists to stop — after a handful of runs every
 * suite failed with 429s that looked like product bugs. Going through Prisma keeps the limiter
 * intact for real traffic while letting the suites run as often as needed.
 *
 * Local development only: it mints a token with the dev JWT secret straight from .env.
 *
 *   node make-test-user.mjs            # prints the token
 */
import "dotenv/config";
import jwt from "jsonwebtoken";
import { PrismaClient } from "../../packages/database/generated/client/index.js";

const prisma = new PrismaClient();
const EMAIL = "tikgames-local-test@example.com";
const USERNAME = "tikgames_local_test";

const user = await prisma.user.upsert({
  where: { email: EMAIL },
  update: {},
  create: {
    email: EMAIL,
    username: USERNAME,
    displayName: "حساب اختبار محلي",
    role: "STREAMER",
  },
});

// Keep the trial open-ended so the account never starts failing access checks mid-suite.
await prisma.subscription.upsert({
  where: { userId: user.id },
  update: { status: "TRIAL", trialEndsAt: new Date(Date.now() + 365 * 24 * 3600 * 1000) },
  create: {
    userId: user.id,
    status: "TRIAL",
    trialEndsAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    trialGamesLimit: 9999,
  },
});

const token = jwt.sign(
  { sub: user.id, role: "STREAMER", jti: "local-test" },
  process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me",
  { expiresIn: "12h" },
);

console.log(token);
await prisma.$disconnect();
