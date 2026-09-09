import { useCallback, useEffect, useState } from "react";
import { DEFAULT_COUNTDOWN_ID, DEFAULT_VICTORY_ID } from "./index";

/**
 * Which design is active, persisted per browser.
 *
 * localStorage rather than the database on purpose: this is a look-and-feel preference for the
 * machine the streamer runs OBS on, it has to be readable synchronously on first paint (a game
 * can start before any fetch resolves), and the overlay reads it without an authenticated
 * session. The trade-off — it does not follow the account to another machine — is the right one
 * for a setting you change once.
 *
 * Both apps share these keys, so the overlay picks up what the dashboard selected on the same
 * machine, and a `storage` event syncs a change across tabs live.
 */

export const COUNTDOWN_KEY = "tikgames.design.countdown";
export const VICTORY_KEY = "tikgames.design.victory";

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    // Private mode, or storage disabled entirely. The default still works.
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* selection just won't persist */
  }
}

export function getSelectedCountdownId(): string {
  return read(COUNTDOWN_KEY, DEFAULT_COUNTDOWN_ID);
}

export function getSelectedVictoryId(): string {
  return read(VICTORY_KEY, DEFAULT_VICTORY_ID);
}

/**
 * Reactive access to one selection.
 *
 * Listens on both the native `storage` event (fires in *other* tabs) and a custom event this
 * module dispatches (fires in the tab that wrote it, which `storage` deliberately does not) —
 * so the picker updates its own "currently selected" badge and every open overlay tab at once.
 */
function useSelection(key: string, fallback: string): [string, (id: string) => void] {
  const [id, setId] = useState(() => read(key, fallback));

  useEffect(() => {
    const sync = () => setId(read(key, fallback));
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT, sync);
    };
  }, [key, fallback]);

  const select = useCallback(
    (next: string) => {
      write(key, next);
      setId(next);
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [id, select];
}

const EVENT = "tikgames:design-changed";

/**
 * Applies a selection that came from the server.
 *
 * The overlay runs on a different origin from the dashboard, so it never sees what the streamer
 * picked in browser storage. It receives the account's stored choice over its socket instead and
 * routes it through here — which writes the same keys the hooks already read and fires the same
 * event, so every component updates without knowing where the value came from.
 *
 * Nulls are ignored rather than cleared: a user who has never opened the picker has null on the
 * account, and that must not wipe a selection already made on this machine.
 */
export function applyDesignPrefs(prefs: {
  countdownDesignId?: string | null;
  victoryDesignId?: string | null;
}): void {
  let touched = false;
  if (prefs.countdownDesignId) {
    write(COUNTDOWN_KEY, prefs.countdownDesignId);
    touched = true;
  }
  if (prefs.victoryDesignId) {
    write(VICTORY_KEY, prefs.victoryDesignId);
    touched = true;
  }
  if (touched) window.dispatchEvent(new Event(EVENT));
}

export function useCountdownSelection(): [string, (id: string) => void] {
  return useSelection(COUNTDOWN_KEY, DEFAULT_COUNTDOWN_ID);
}

export function useVictorySelection(): [string, (id: string) => void] {
  return useSelection(VICTORY_KEY, DEFAULT_VICTORY_ID);
}
