import "dotenv/config";
import { createServer } from "node:http";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import adminRouter, { UPLOAD_ROOT } from "./routes/admin.js";
import analyticsRouter from "./routes/analytics.js";
import authRouter from "./routes/auth.js";
import gamesRouter from "./routes/games.js";
import leaderboardRouter from "./routes/leaderboard.js";
import liveRouter from "./routes/live.js";
import overlaysRouter from "./routes/overlays.js";
import productsRouter from "./routes/products.js";
import { setupSocketServer } from "./realtime/socket.js";

const PORT = Number(process.env.PORT ?? 4000);
// Comma-separated — the dashboard (5173) and the OBS overlay (5174) are two different origins,
// both legitimately calling this API/socket server. A single-string origin here silently blocks
// every overlay socket connection with a CORS error while the dashboard keeps working fine,
// which is easy to miss since nothing about the dashboard flow ever surfaces it.
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "tikgames-api", phase: 3 });
});

app.use("/auth", authRouter);
app.use("/live", liveRouter);
app.use("/products", productsRouter);
app.use("/overlays", overlaysRouter);
app.use("/games", gamesRouter);
app.use("/analytics", analyticsRouter);
app.use("/leaderboard", leaderboardRouter);
app.use("/uploads", express.static(UPLOAD_ROOT));
app.use("/admin", adminRouter);

// Last-resort safety net: any error forwarded via asyncHandler (or thrown synchronously) lands
// here instead of crashing the process. Without this, one bad request could take down every
// in-flight request for every user.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[api] Unhandled error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "حصل خطأ في السيرفر، حاول تاني" });
});

process.on("unhandledRejection", (reason) => {
  console.error("[api] Unhandled rejection outside Express:", reason);
});

const httpServer = createServer(app);
setupSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[api] TikGames API listening on http://localhost:${PORT}`);
  console.log("[api] Auth is live: /auth/register, /auth/login, /auth/refresh, /auth/me");
  console.log(
    "[api] Platform routes mounted: /live, /products, /games, /analytics, /leaderboard, /uploads, /admin. Socket.io namespaces: /internal, /overlay, /dashboard",
  );
});
