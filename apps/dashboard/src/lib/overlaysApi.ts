import type {
  OverlayWidgetDefinition,
  OverlayWidgetSettings,
  WidgetSnapshot,
  WidgetTimerState,
} from "@tikgames/shared-types";
import { authedFetch, parseJsonOrThrow } from "./apiClient";

export type { OverlayWidgetDefinition, OverlayWidgetSettings };

export interface WidgetGalleryResponse {
  widgets: OverlayWidgetDefinition[];
  settings: Record<string, OverlayWidgetSettings>;
  overlayToken: string | null;
  liveSessionId: string | null;
}

export async function getWidgetGallery(): Promise<WidgetGalleryResponse> {
  const res = await authedFetch("/overlays/widgets/me");
  return parseJsonOrThrow(res);
}

export async function saveWidgetSettings(
  widgetId: string,
  settings: OverlayWidgetSettings,
): Promise<{ widgetId: string; settings: OverlayWidgetSettings }> {
  const res = await authedFetch(`/overlays/widgets/${widgetId}`, {
    method: "PUT",
    body: JSON.stringify({ settings }),
  });
  return parseJsonOrThrow(res);
}

export async function resetWidgetSettings(
  widgetId: string,
): Promise<{ widgetId: string; settings: OverlayWidgetSettings }> {
  const res = await authedFetch(`/overlays/widgets/${widgetId}`, { method: "DELETE" });
  return parseJsonOrThrow(res);
}

export async function testWidget(widgetId: string): Promise<{ ok: true }> {
  const res = await authedFetch(`/overlays/test/${widgetId}`, { method: "POST" });
  return parseJsonOrThrow(res);
}

/** Zeroes a widget's own counter (currently the coin jar). Independent of every other tally. */
export async function resetWidgetState(widgetId: string): Promise<{ ok: true }> {
  const res = await authedFetch(`/overlays/reset/${widgetId}`, { method: "POST" });
  return parseJsonOrThrow(res);
}

export async function setOverlayTimer(
  seconds: number,
  label: string,
): Promise<{ timer: WidgetTimerState }> {
  const res = await authedFetch("/overlays/timer", {
    method: "POST",
    body: JSON.stringify({ seconds, label }),
  });
  return parseJsonOrThrow(res);
}

export async function getOverlaySnapshot(): Promise<{ snapshot: WidgetSnapshot | null }> {
  const res = await authedFetch("/overlays/snapshot");
  return parseJsonOrThrow(res);
}
