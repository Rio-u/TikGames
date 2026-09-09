import {
  ChatCircleDots,
  Clock,
  Coins,
  Confetti,
  Crown,
  Eye,
  Gift,
  Heart,
  ListNumbers,
  Rocket,
  RocketLaunch,
  ShareNetwork,
  Target,
  UserPlus,
  type Icon,
} from "@phosphor-icons/react";

/** One icon per widget id. Same split as productIcons: shared-types stays framework-free, the
 *  mapping to components lives here. */
const WIDGET_ICONS: Record<string, Icon> = {
  CHAT: ChatCircleDots,
  GIFT_FEED: Gift,
  TOP_GIFTERS: Crown,
  TOP_LIKERS: Heart,
  VIEWER_COUNT: Eye,
  LIKE_FOUNTAIN: Confetti,
  GIFT_CANNON: Rocket,
  GIFT_FIREWORK: RocketLaunch,
  GIFT_GOAL: Target,
  COIN_JAR: Coins,
  RANKING: ListNumbers,
  TIMER: Clock,
  SOCIAL_ROTATOR: ShareNetwork,
  LAST_FOLLOWER: UserPlus,
};

export function widgetIcon(id: string): Icon {
  return WIDGET_ICONS[id] ?? Gift;
}
