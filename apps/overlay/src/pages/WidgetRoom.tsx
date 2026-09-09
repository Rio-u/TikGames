import { useParams, useSearchParams } from "react-router-dom";
import { useWidget } from "../lib/widget";
import {
  ChatWidget,
  GiftFeedWidget,
  RankingWidget,
  TopGiftersWidget,
  TopLikersWidget,
} from "../widgets/ListWidgets";
import { CoinJarWidget } from "../widgets/CoinJarWidget";
import { GiftCannonWidget, GiftGoalWidget, LikeFountainWidget } from "../widgets/EffectWidgets";
import { GiftFireworkWidget } from "../widgets/GiftFireworkWidget";
import {
  LastFollowerWidget,
  SocialRotatorWidget,
  TimerWidget,
  ViewerCountWidget,
} from "../widgets/UtilityWidgets";

/**
 * One browser source = one widget. The token in the path is the only credential (same as the
 * game overlay's /o/:token), and `widgetId` picks what to render.
 *
 * `?preview=1` is what the dashboard's customise dialog uses: it renders on a visible backdrop
 * instead of the transparent one OBS needs, so the streamer can actually see light-coloured text
 * while they pick colours.
 */
export default function WidgetRoom() {
  const { overlayToken, widgetId } = useParams<{ overlayToken: string; widgetId: string }>();
  const [params] = useSearchParams();
  const preview = params.get("preview") === "1";

  const id = (widgetId ?? "").toUpperCase();
  const { settings, socket, error } = useWidget(overlayToken, id);

  if (error) {
    return (
      <div dir="rtl" className="flex h-dvh items-center justify-center p-4">
        <p className="rounded-xl bg-black/60 px-4 py-2 text-sm text-white">{error}</p>
      </div>
    );
  }

  // Render nothing rather than a spinner while settings load — a flash of loading UI would be
  // burned into the stream for anyone watching at that moment.
  if (!settings) return <div className="h-dvh w-full" />;

  const body = (() => {
    switch (id) {
      case "CHAT":
        return <ChatWidget settings={settings} socket={socket} />;
      case "GIFT_FEED":
        return <GiftFeedWidget settings={settings} socket={socket} />;
      case "TOP_GIFTERS":
        return <TopGiftersWidget settings={settings} socket={socket} />;
      case "TOP_LIKERS":
        return <TopLikersWidget settings={settings} socket={socket} />;
      case "RANKING":
        return <RankingWidget settings={settings} overlayToken={overlayToken!} />;
      case "VIEWER_COUNT":
        return <ViewerCountWidget settings={settings} socket={socket} />;
      case "LIKE_FOUNTAIN":
        return <LikeFountainWidget settings={settings} socket={socket} />;
      case "GIFT_CANNON":
        return <GiftCannonWidget settings={settings} socket={socket} />;
      case "GIFT_FIREWORK":
        return <GiftFireworkWidget settings={settings} socket={socket} />;
      case "GIFT_GOAL":
        return <GiftGoalWidget settings={settings} socket={socket} />;
      case "COIN_JAR":
        return <CoinJarWidget settings={settings} socket={socket} />;
      case "TIMER":
        return <TimerWidget settings={settings} socket={socket} />;
      case "SOCIAL_ROTATOR":
        return <SocialRotatorWidget settings={settings} />;
      case "LAST_FOLLOWER":
        return <LastFollowerWidget settings={settings} socket={socket} />;
      default:
        return (
          <div dir="rtl" className="flex h-dvh items-center justify-center p-4">
            <p className="rounded-xl bg-black/60 px-4 py-2 text-sm text-white">
              ودجت غير معروفة: {id}
            </p>
          </div>
        );
    }
  })();

  if (!preview) return body;

  return (
    <div
      className="h-dvh w-full"
      style={{
        // A checkerboard stands in for transparency so the streamer can judge contrast against
        // both light and dark scene content while customising.
        background:
          "repeating-conic-gradient(#1a1526 0% 25%, #120e1c 0% 50%) 0 0 / 22px 22px",
      }}
    >
      {body}
    </div>
  );
}
