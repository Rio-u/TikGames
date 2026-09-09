/**
 * Downloads TikTok's gift catalogue — every gift's name, coin (diamond) value and artwork.
 *
 * Source is TikTok's own public webcast `gift/list/` endpoint, read for a currently-live room.
 * That is the same catalogue the live gift events are drawn from, so names and coin values match
 * exactly what viewers see and send. The endpoint needs a room id, which is why a live account is
 * looked up first — the room is only used to address the request, nothing about it is stored.
 *
 * Re-run this whenever the catalogue should be refreshed; TikTok adds and retires gifts often, so
 * a checked-in copy goes stale. `gifts.json` is the index the app reads; `images/` holds the art.
 *
 *   node fetch-gifts.mjs <live-username> [more usernames as fallbacks...]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { TikTokLiveConnection } from "tiktok-live-connector";

const OUT_DIR = new URL("../../packages/database/gift-catalog/", import.meta.url);
const IMG_DIR = new URL("images/", OUT_DIR);

const CANDIDATES = process.argv.slice(2);
if (!CANDIDATES.length) {
  console.log("usage: node fetch-gifts.mjs <live-username> [fallback-usernames...]");
  process.exit(1);
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  Referer: "https://www.tiktok.com/",
  "Accept-Language": "en-US,en;q=0.9",
};

async function findLiveRoom() {
  for (const user of CANDIDATES) {
    const conn = new TikTokLiveConnection(user, {
      processInitialData: false,
      fetchRoomInfoOnConnect: false,
    });
    try {
      const roomId = await conn.fetchRoomId();
      if (roomId) {
        console.log(`live room found via @${user}: ${roomId}`);
        return roomId;
      }
    } catch (err) {
      console.log(`  @${user}: ${(err?.message ?? "").slice(0, 80)}`);
    } finally {
      try {
        conn.disconnect();
      } catch {}
    }
  }
  return null;
}

/** Gift artwork comes as a url_list of equivalent CDN mirrors; take the first that looks usable. */
function pickImage(gift) {
  const lists = [gift?.image?.url_list, gift?.icon?.url_list, gift?.image?.urlList];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    const hit = list.find((u) => typeof u === "string" && u.startsWith("http"));
    if (hit) return hit;
  }
  return null;
}

function extensionOf(url) {
  const clean = url.split("?")[0] ?? "";
  const match = /\.(png|webp|jpe?g|gif)$/i.exec(clean);
  return match ? match[1].toLowerCase() : "webp";
}

/** Modest concurrency: enough to finish quickly, low enough not to hammer the CDN. */
async function inBatches(items, size, worker) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(worker))));
  }
  return results;
}

const roomId = await findLiveRoom();
if (!roomId) {
  console.log("\nNo live room found — the gift list endpoint needs one to address the request.");
  console.log("Pass any account that is currently live on TikTok and try again.");
  process.exit(2);
}

const res = await fetch(
  `https://webcast.tiktok.com/webcast/gift/list/?aid=1988&app_language=en&device_platform=web&room_id=${roomId}`,
  { headers: BROWSER_HEADERS },
);
const payload = await res.json();
const gifts = payload?.data?.gifts;
if (!Array.isArray(gifts)) {
  console.log("Unexpected response:", JSON.stringify(payload).slice(0, 300));
  process.exit(3);
}
console.log(`catalogue returned ${gifts.length} gifts\n`);

// TikTok lists some gifts more than once (the same id appears in several panels/regions). Keep
// one record per id, otherwise the index claims more gifts than there are image files and any
// id-keyed lookup built from it is ambiguous.
const byId = new Map();
for (const g of gifts) {
  const id = String(g.id ?? "");
  if (!id || !g.name || byId.has(id)) continue;
  byId.set(id, {
    id,
    name: g.name,
    coins: Number(g.diamond_count ?? 0) || 0,
    type: g.type ?? null,
    // Streakable gifts (type 1) repeat while held — the widgets already treat these differently.
    streakable: g.type === 1,
    imageUrl: pickImage(g),
    file: null,
  });
}

const catalog = [...byId.values()];
const duplicates = gifts.length - catalog.length;
if (duplicates > 0) console.log(`(dropped ${duplicates} duplicate listing(s))`);

catalog.sort((a, b) => a.coins - b.coins || a.name.localeCompare(b.name));

await mkdir(IMG_DIR, { recursive: true });

let saved = 0;
let failed = 0;
await inBatches(catalog, 12, async (gift) => {
  if (!gift.imageUrl) {
    failed += 1;
    return;
  }
  try {
    const img = await fetch(gift.imageUrl, { headers: BROWSER_HEADERS });
    if (!img.ok) throw new Error(String(img.status));
    const buf = Buffer.from(await img.arrayBuffer());
    const file = `${gift.id}.${extensionOf(gift.imageUrl)}`;
    await writeFile(new URL(file, IMG_DIR), buf);
    gift.file = file;
    saved += 1;
  } catch {
    failed += 1;
  }
});

await writeFile(new URL("gifts.json", OUT_DIR), JSON.stringify(catalog, null, 2), "utf8");

const withCoins = catalog.filter((g) => g.coins > 0);
console.log(`saved   ${saved} images`);
console.log(`failed  ${failed}`);
console.log(`index   gifts.json (${catalog.length} gifts)`);
console.log(
  `coins   cheapest ${withCoins[0]?.coins} (${withCoins[0]?.name}) → priciest ${withCoins.at(-1)?.coins} (${withCoins.at(-1)?.name})`,
);
