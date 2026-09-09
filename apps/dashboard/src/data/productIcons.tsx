import {
  BellRinging,
  ChartLineUp,
  GameController,
  Monitor,
  SquaresFour,
  Trophy,
  type Icon,
} from "@phosphor-icons/react";

/**
 * `ProductDefinition.icon` is a plain string in shared-types on purpose — that package is
 * framework-free and imported by the API too, so it can't carry JSX. This is the one place the
 * string becomes a component; a new product adds its key here and nowhere else.
 */
const PRODUCT_ICONS: Record<string, Icon> = {
  games: GameController,
  overlay: Monitor,
  trophy: Trophy,
  chart: ChartLineUp,
  bell: BellRinging,
  widget: SquaresFour,
};

export function productIcon(key: string): Icon {
  return PRODUCT_ICONS[key] ?? SquaresFour;
}
