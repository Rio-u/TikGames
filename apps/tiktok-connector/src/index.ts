import "dotenv/config";
import { startInternalClient } from "./internalClient.js";

console.log("[tiktok-connector] TikGames connector service starting...");
console.log(
  "[tiktok-connector] Unofficial TikTok integration (tiktok-live-connector) — see README for the risk notes.",
);

startInternalClient();

process.on("unhandledRejection", (reason) => {
  console.error("[tiktok-connector] Unhandled rejection:", reason);
});
