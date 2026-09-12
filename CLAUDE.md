# TikGames

TikTok-live interactive games platform. A streamer goes live, connects their TikTok account, picks a
game, and viewers play by typing commands in the live chat. Every game the streamer runs is rendered
twice from the same server-pushed state: once on their dashboard control page (for the streamer) and
once on a browser-source overlay (for OBS, shown on stream).

Everything user-facing is Arabic, RTL. Wrap any user-generated display name in `<bdi>` — TikTok
handles/names can be Latin or Arabic, and bidi text next to fixed RTL chrome breaks without it.

## Monorepo layout

- `apps/api` — Express + Socket.io + Prisma/PostgreSQL. Owns all game logic, auth, and realtime fan-out.
- `apps/dashboard` — React/Vite/Tailwind. Streamer-facing: auth, account, game library, per-game control pages.
- `apps/overlay` — React/Vite. OBS browser-source facing, token-scoped, read-only view of the same state.
- `apps/tiktok-connector` — wraps the unofficial `tiktok-live-connector` lib, normalizes TikTok events into `LiveEvent`s over the `/internal` socket namespace.
- `packages/shared-types` — single source of truth for every cross-app contract (game state shapes, socket event names).
- `packages/database` — Prisma schema, PostgreSQL (Supabase). One cloud database for both local dev and production.

## How a game actually runs

1. Streamer clicks "ابدأ اللعبة" on their control page → `POST /games/configs` (saves settings) → `POST /games/session/start` (creates a `GameSession` row, instantiates the engine, stores it in `activeEngines`).
2. Every viewer comment comes in through `apps/tiktok-connector` (or the `/live/simulate` test page, which hits the exact same code path) → `handleLiveEvent()` in `apps/api/src/realtime/commentIngestion.ts` → looks up the engine for that live session in `activeEngines` and calls `engine.handleComment(...)`.
3. Every engine mutation calls its own `onChange`, which persists `GameSession.state` and broadcasts `game:state` to both the `/dashboard` and `/overlay` socket namespaces via `broadcastToLive()`.
4. Both frontends are pure renderers of the same `state` object — neither holds any game logic. That's why a new game only needs a new engine class plus two render components; nothing about the transport ever changes.

## Adding a new game — the checklist

Follow this order; each step depends on the one before it. Use Musical Chairs (`MUSICAL_CHAIRS`) or
Trivia (`TRIVIA`) as the reference implementation at every step — they're deliberately kept as twins
so you can diff against whichever is structurally closer to the new game.

1. **Types — `packages/shared-types/src/index.ts`**
   Add the game to the `GameType` union, then define `<Name>Settings`, `<Name>Phase`, `<Name>Player` (if it has scoring/participants), and `<Name>State`. Every state shape shares this spine — keep it:
   ```ts
   interface XState {
     gameType: "X";
     gameSessionId: string;
     phase: XPhase;
     settings: XSettings;
     players: XPlayer[];         // omit only if the game truly has no roster
     round: number;
     winner: XPlayer | null;     // null until FINISHED (or if nobody qualifies)
     phaseEndsAt: string | null; // ISO timestamp, server-authoritative countdown target
   }
   ```
   A `FINISHED` phase and a `winner: X | null` field are load-bearing — `WinnerCelebration` (step 5) and the control shell's "لعبة جديدة" button both key off `phase === "FINISHED"`.

   **If the game has a value that must stay hidden until a reveal moment** (Guess Number/Word's
   secret is the precedent): never put it in `XSettings` as embedded in `XState.settings` — that
   object gets echoed back verbatim by every engine's `getState()`, and `game:state` broadcasts
   the *exact same payload* to both the `/dashboard` and `/overlay` namespaces (there is no
   per-namespace filtering anywhere in this codebase, so "just hide it on the overlay" isn't a
   thing). Instead: keep the full settings type (with the secret) for `POST /configs`
   validation/storage only, define a redacted `XPublicSettings` (`Omit<XSettings, "secret">`) for
   what actually appears in `XState.settings`, and expose the secret itself as its own top-level
   state field gated on `phase === "FINISHED"` inside `getState()` — see `GuessNumberEngine` for
   the exact pattern (`GuessNumberPublicSettings`, `state.secret`).

2. **Engine — `apps/api/src/games/<name>.ts`**
   A class matching this exact shape (copy `musicalChairs.ts` — it's the more elaborate of the two references):
   - `constructor(gameSessionId, settings, onChange)` — keep an internal state machine, never the wire `state` itself; `getState()` builds that shape on demand.
   - `handleComment(handle, displayName, avatarUrl, text): void` — the single entry point `commentIngestion.ts` calls for every viewer comment. Route to internal handlers (join, answer, guess, ...) from here; invalid/late/duplicate input is always a silent no-op, never a thrown error — chat input is inherently unreliable and retryable. If the game is comparing a viewer's raw text against a target answer/secret, reuse `normalizeAnswer()` from `apps/api/src/games/textNormalize.ts` (case-folds, unifies the Arabic alef/teh-marbuta/alef-maksura variants typists routinely mix up, strips punctuation/diacritics) rather than a plain `===` — already shared by Trivia and Guess Number/Word.
   - `begin(): boolean` — closes setup and starts the timed phases. Return `false` if preconditions aren't met (not enough players, wrong phase); the route layer turns `false` into a 400.
   - `stop(): void` — force-ends early (streamer cancels). Idempotent, clears any pending timer, sets `phase = "FINISHED"`.
   - `getState(): XState` — pure snapshot, no side effects.
   - Phase transitions are `setTimeout`-driven; every timer sets `phaseEndsAt = new Date(Date.now() + DURATION)` *before* calling `emitChange()`, so the client countdown (`useCountdown`, step 5) is always driven by the server clock, never a client-side timer.
   - Every mutating method ends with `this.emitChange()` (→ `this.onChange(this.getState())`). No exceptions — a caller that forgets this produces a stuck UI, not a thrown error, so it's easy to miss without deliberate testing.

3. **Registry — `apps/api/src/realtime/registry.ts`**
   Add the new engine class to the `AnyGameEngine` union. That's the only change this file needs — `activeEngines` / `liveSessionToGameSession` / `broadcastToLive` are already generic.

4. **Routes — `apps/api/src/routes/games.ts`**
   Three spots, all in this one file:
   - A `DEFAULT_<NAME>_SETTINGS` constant.
   - A validation branch in `POST /configs` (`if (gameType === "X") { ...validate settings, prisma.gameConfig.create... }`).
   - Extend the `gameType !== "MUSICAL_CHAIRS" && gameType !== "TRIVIA"` guard in `POST /session/start`, and add a branch to the `engine = gameType === "..." ? new XEngine(...) : ...` chain.
   If the new game needs its own admin-curated or streamer-uploaded assets (Trivia's background image pool is the precedent), fetch/validate that pool here too, before constructing the engine — see the `triviaBackgroundPool` block for the pattern (400 with an Arabic error if the pool is empty; don't let the engine start into a broken state).

5. **View components — one pair, both apps**
   `apps/overlay/src/components/<Name>Overlay.tsx` and `apps/dashboard/src/components/<Name>GameView.tsx`. These are two independent files (not shared — overlay is a passive stream layer with no interaction, dashboard is the streamer's own bigger-screen view), but keep them structurally identical and reuse the same pieces:
   - Layout convention, matched across every game so streamers never have to relearn the screen: **participants on the right, leaderboard (+ chat) on the left, center = the game's own content.** Concretely a `grid-cols-[participants_1fr_leaderboard]` (RTL, so the first column renders on the right). Dashboard versions additionally stack `<ChatBox>` under the leaderboard in that same left column; overlay versions render `<ChatStrip>` as a full-width strip along the bottom instead (screen space is tighter and shared with the rest of the OBS scene).
   - Reuse rather than reinvent: `PlayerAvatar`, `useCountdown` (feed it `phase === "TIMED_PHASE" ? state.phaseEndsAt : null`), `Branding` (overlay only).
   - **If the game plays audio**, copy the `MusicPlayer` pattern from `MusicalChairsGameView`/`MusicalChairsOverlay` exactly: one persistent `<audio>` element mounted at the game-view root for the whole game (never per-phase — a per-phase mount re-triggers autoplay blocking every round and the fallback button dies with the phase), play/pause driven by an `active` prop, plus a document-level `pointerdown` unlock (silent volume-0 play+pause inside the user's first natural click) because strict-autoplay browsers (Brave blocks per-site by default) reject `play()` outside a gesture. Verified working on both Chrome and Brave via the real-browser test below.
   - `AnimatePresence mode="wait"` around the phase switch, keyed by a phase-group key (e.g. `"waiting" | "round" | "finished"`), spring or eased fade between them — see either reference file.
   - **FINISHED phase always renders `<WinnerCelebration>`**, never bespoke winner UI. `state.winner` can be `null` even in FINISHED — a timeout with nobody scoring, or the streamer hitting "وقف اللعبة" mid-round — every game must handle both branches, not just wrap the winner branch in an `&&` and skip the rest (that renders nothing at all, a real bug hit once already):
     ```tsx
     {state.winner ? (
       <WinnerCelebration
         displayName={state.winner.displayName}
         avatarUrl={state.winner.avatarUrl}
         handle={state.winner.handle}
         subtitle={/* optional, game-specific: score, round count, ... */}
       />
     ) : (
       // dashboard: <NoWinnerScreen message="..." onNewRound={onNewRound} />
       // overlay: a plain message-only card (see Trivia/MusicalChairsOverlay) — no buttons, stays passive
     )}
     ```
     `WinnerCelebration` already owns its own `Confetti` burst, glow flash, bouncing trophy, and staggered card reveal — don't add a second `<Confetti>` next to it. `subtitle` is the *only* customization point; needing more than one extra line is a sign the game wants its own small addition below the card, not a fork of the component.
     On the **dashboard**, the no-winner branch is `<NoWinnerScreen>` (`apps/dashboard/src/components/NoWinnerScreen.tsx`) — icon, a game-specific `message`, and two real buttons ("ابدأ دور جديد" / "الرجوع للداشبورد"). It needs `onNewRound`, which `renderGameView` receives as its third argument (see step 7) — thread it straight through, it's already the same handler behind the header's own "لعبة جديدة" button, nothing new to wire up. On the **overlay** this stays a plain message-only card, matching `WinnerCelebration`'s own dashboard/overlay split (overlay never gets buttons — nobody's meant to click anything there).

6. **Overlay routing — `apps/overlay/src/pages/OverlayRoom.tsx`**
   Add a branch: `if (gameState?.gameType === "X") return <XOverlay .../>;`.

7. **Dashboard control page — `apps/dashboard/src/pages/<Name>Control.tsx`**
   A thin config wrapper around `<GameControlShell>` — see `TriviaControl.tsx` for the minimal version (one settings field) or `MusicalChairsControl.tsx` for a slightly richer one. You supply: `gameType`, `pageTitle`, `icon`, `configName`, `buildSettings()`, `renderSettings()` (the pre-game settings form), `renderGameView(state, chat, onNewRound)` (the component from step 5 — forward `onNewRound` straight through so its `NoWinnerScreen` can use it), `isWaitingPhase`/`isActivePhase` (map your phase enum to the shell's begin/stop button visibility), `statusText(state)`, `beginLabel`, and optionally `beginDisabled(state)`. `GameControlShell` (`apps/dashboard/src/components/GameControlShell.tsx`) owns everything generic: the live-session guard, the socket connection and `game:state`/`chat:comment` listeners, the settings-card → fullscreen-game transition, and the begin/stop/"لعبة جديدة"/exit button lifecycle. Don't duplicate any of that in the new page.

   Decide whether your game's `WAITING_TO_START`-style phase does real work. If it's actually
   collecting a roster before anything can start (Musical Chairs' `WAITING_FOR_PLAYERS` — you
   need players before you can eliminate anyone), leave `autoBegin` unset: the streamer sees that
   phase and clicks a separate begin button once ready. If the waiting phase has no function
   beyond being an artifact of `POST /session/start` and `POST /session/:id/begin` being two
   separate calls (Trivia, Guess Number — nothing is "gathering"), pass `autoBegin` so "ابدأ
   اللعبة" chains straight through to begin() and the streamer never sees that screen at all.

8. **Route registration — `apps/dashboard/src/App.tsx`**
   Add `<Route path="/live/<name>" element={<ProtectedRoute><XControl /></ProtectedRoute>} />`.

9. **Library card — `apps/dashboard/src/data/games.ts`**
   Set `route: "/live/<name>"` on the matching `GameDefinition`. This is the single switch that turns the library card from a disabled "قريباً" tile into a working link — see the doc comment on `GameDefinition.route` in that file. Nothing else in `Dashboard.tsx` needs to change; it already splits `GAMES` into `availableGames` (has `route`) vs `comingSoonGames` (doesn't) automatically.

Steps 1–4 are backend and can be typechecked/tested in isolation (see Testing below); steps 5–9 are
frontend and share nothing with the backend except the types from step 1.

## Shared pieces — reuse, don't fork

Extracted only once actually reused by 2+ games, not before (a deliberate project rule — don't
pre-abstract for a third game that doesn't exist yet):

| Piece | Where | Used for |
|---|---|---|
| `GameControlShell` | `apps/dashboard/src/components/` | Every control page's settings→fullscreen→lifecycle chrome |
| `WinnerCelebration` | both apps, `src/components/` | The FINISHED-phase payoff moment, identical across games |
| `NoWinnerScreen` | dashboard only, `src/components/` | FINISHED-with-no-winner fallback — icon, message, "ابدأ دور جديد"/"الرجوع للداشبورد" |
| `Confetti` | both apps, `src/components/` | Owned internally by `WinnerCelebration` — don't call it directly from a game view |
| `ChatBox` / `ChatStrip` | dashboard / overlay `src/components/` | Live comment feed — box (dashboard, tall aside) vs strip (overlay, bottom bar) |
| `Branding` | overlay `src/components/` | Corner logo/watermark, overlay only |
| `PlayerAvatar` | both apps, `src/components/` | Consistent avatar+fallback rendering everywhere a player appears |
| `useCountdown` | both apps, `src/lib/` | Ticks down from a server `phaseEndsAt` ISO string |
| `useLiveSession` | dashboard `src/lib/` | Fetch-on-mount current live session; used by `Dashboard`'s go-live card and every control page |
| `useDisabledGames` | dashboard `src/lib/` | Fetch-on-mount admin-disabled game list; used by the library grid and `GameControlShell` |

## Admin controls

- **Per-game kill switch** — `GameToggle` (one row per `GameType`, no seed needed — a missing row means enabled, fail-open). Admin toggles it from `/d7admind7`'s "محتوى الألعاب" tab; `POST /games/session/start` is the real gate (checked server-side before creating a session); `useDisabledGames` just mirrors that into the UI so a disabled game reads as "متوقفة مؤقتاً" on the library card and control page instead of surfacing a raw 400. Disabling only blocks *new* sessions — it never touches one already running. Keyed by `GameType`, so a new game needs zero extra wiring here.
- **Admin action log** — every admin mutation in `apps/api/src/routes/admin.ts` goes through the shared `logAdminAction()` helper (writes `AdminActionLog`, viewable in the admin page's "سجل النشاط" tab). Any new admin endpoint should call it too, same pattern as the existing ones.
- **Discord mirror** — optional, off by default. Set `DISCORD_ADMIN_LOG_WEBHOOK_URL` (apps/api env) to a Discord incoming-webhook URL and `notifyDiscord()` (`apps/api/src/lib/discordWebhook.ts`) mirrors every admin action plus every WARNING/CRITICAL alert there. Unset = silent no-op, never blocks the request that triggered it.

## Socket reconnects

Every page that manages its own socket and calls `socket.emit("join", liveSessionId)` must also
re-emit `join` on the socket's `"connect"` event, not just once on mount — socket.io rooms don't
survive a reconnect (network blip, a backgrounded tab getting throttled, ...), so without this a
dropped connection silently stops `game:state`/`chat:comment` delivery until the page is reloaded
(this is exactly what made the winner-celebration screen look like it had frozen the live chat).
See `GameControlShell`, `Dashboard`'s `LiveCard`, and `LiveSimulate` for the pattern. A new game's
control page goes through `GameControlShell`, which already does this — never re-implement socket
wiring directly in a new control page.

## Testing a new game

No test framework is wired up — verification is manual but should still be real, not just a
typecheck:
- `tsc --noEmit` in every touched package first (`apps/api`, `apps/dashboard`, `apps/overlay`) — cheap, catches most wiring mistakes instantly.
- For engine logic, a standalone Node script that instantiates the engine directly and drives it through `handleComment`/`begin`/`stop`, asserting on `getState()` — no server needed.
- For the full loop, a Node `fetch` + `socket.io-client` script against the actually-running dev API: register a throwaway account (clean it up afterward via a temporary Prisma script), start a live session, start the game, drive it with simulated comments through `/live/:id/simulate-comment`, assert on the `game:state` broadcasts. Prefer this over shell/curl for anything with Arabic text or tight timers — multi-call latency between separate tool invocations is enough to desync a short-lived phase window; a single atomic script avoids that class of false negative.
- No shortcuts on "does it look right": force Vite to transform the new/changed files and check the dev server logs for errors, and where feasible actually look at the rendered game (both control page and overlay).
- For anything only a real browser can prove (audio playback, layout, animation), `playwright-core` + the system Chrome (`chromium.launch({ channel: "chrome" })` — no browser download) driving the real login → start-live → play flow works on this machine and is the strongest evidence available. Note: start the live session *right before* opening the control page — a fake test channel flips to ERROR within seconds, and although errored lives stay current (see `ACTIVE_STATUSES` in `apps/api/src/routes/live.ts`), a real TikTok connection isn't needed for any of this since simulated comments drive everything.
