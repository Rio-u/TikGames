import { ArrowRight, GameController, Star, WarningCircle } from "@phosphor-icons/react";
import { motion, type Variants } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardHeader } from "../components/DashboardHeader";
import { Container } from "../components/Container";
import { GameCard } from "../components/GameCard";
import { Reveal } from "../components/Reveal";
import { GAMES, type GameDefinition } from "../data/games";
import { useAuth } from "../lib/auth";
import { mergeGameContent } from "../lib/gameContent";
import { staggerContainer, viewportOnce } from "../lib/motion";
import { useDisabledGames } from "../lib/useDisabledGames";
import { useGameContent } from "../lib/useGameContent";
import { useHomepageSettings } from "../lib/useHomepageSettings";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "مساء الخير";
  if (hour < 12) return "صباح الخير";
  if (hour < 18) return "يومك سعيد";
  return "مساء الخير";
}

const featuredCardVariant: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 220, damping: 20 },
  },
};

/** The admin-picked "spotlight" version of a game card — same data as GameCard but with a
 *  rotating gradient ring, pulsing glow, and a "مميزة" badge, so the featured row reads as
 *  distinctly more premium than the plain library grid below it. */
function FeaturedGameCard({ game, disabledReason }: { game: GameDefinition; disabledReason?: string }) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => setImgError(false), [game.imageUrl]);
  const showImage = !imgError;
  const blocked = !!disabledReason;
  const isLink = !!game.route && !blocked;

  const content = (
    <motion.div
      whileHover={isLink ? { scale: 1.035, y: -4 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group relative h-full overflow-hidden rounded-3xl p-[2px]"
    >
      <span className="absolute -inset-3 -z-10 animate-glow-pulse rounded-3xl bg-accent/30 blur-2xl" />
      <div className="absolute -inset-[50%] bg-[conic-gradient(from_0deg,#7c3aed,#c084fc,#a855f7,#7c3aed)] animate-spin-slow" />
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-[22px] bg-canvas-elevated ${blocked ? "opacity-80" : ""}`}
      >
        <div
          className={`relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br ${game.gradient} ${blocked ? "grayscale-[0.5]" : ""}`}
        >
          {showImage && (
            <img
              src={game.imageUrl}
              alt={game.nameAr}
              loading="lazy"
              onError={() => setImgError(true)}
              className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ${isLink ? "group-hover:scale-110" : ""}`}
            />
          )}
          {!showImage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="absolute h-32 w-32 animate-glow-pulse rounded-full bg-white/25 blur-3xl" />
              <span className="animate-float relative text-9xl opacity-95 drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]">
                {game.emoji}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-canvas-elevated/95 via-canvas-elevated/10 to-transparent" />
          <motion.span
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-4 top-4 flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-200 shadow-glow-sm backdrop-blur-md"
          >
            <Star size={13} weight="fill" />
            مميزة
          </motion.span>
        </div>

        <div className="flex flex-1 flex-col p-6">
          <h3 className="mb-2 text-xl font-bold">{game.nameAr}</h3>
          <p className="mb-4 text-sm leading-relaxed text-ink-muted">{game.descriptionAr}</p>
          {isLink && (
            <span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-semibold text-white shadow-glow transition-transform duration-300 group-hover:scale-105">
              شغّلها دلوقتي
              <ArrowRight size={13} weight="bold" className="rtl:rotate-180" />
            </span>
          )}
          {blocked && (
            <p className="mt-auto flex items-center gap-1.5 text-xs font-medium text-amber-300/90">
              <WarningCircle size={14} weight="fill" />
              {disabledReason}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );

  if (isLink && game.route) {
    return (
      <Link to={game.route} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;

  const firstName = user.displayName.split(" ")[0];
  const gameContent = useGameContent();
  const availableGames = GAMES.filter((g) => g.route).map((g) => mergeGameContent(g, gameContent.get(g.id)));
  const comingSoonGames = GAMES.filter((g) => !g.route).map((g) => mergeGameContent(g, gameContent.get(g.id)));
  const disabledGames = useDisabledGames();
  const homepage = useHomepageSettings();
  const allGamesById = new Map([...availableGames, ...comingSoonGames].map((g) => [g.id, g]));
  const featuredGames = homepage.featuredGameTypes.map((id) => allGamesById.get(id)).filter((g): g is GameDefinition => !!g);

  return (
    <div className="min-h-dvh">
      <DashboardHeader />

      <Container className="space-y-10 py-10">
        <Reveal>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {getGreeting()}، {firstName} 👋
          </h1>
        </Reveal>

        {featuredGames.length > 0 && (
          <div>
            <Reveal>
              <div className="mb-5 flex items-center gap-2">
                <Star size={22} className="text-amber-300" weight="fill" />
                <h2 className="text-xl font-bold sm:text-2xl">{homepage.heroTitle || "الألعاب المميزة"}</h2>
              </div>
            </Reveal>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              variants={staggerContainer}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {featuredGames.map((game) => (
                <motion.div key={game.id} className="flex" variants={featuredCardVariant}>
                  <FeaturedGameCard
                    game={game}
                    disabledReason={disabledGames.has(game.id) ? "الأدمن أوقف اللعبة دي مؤقتاً" : undefined}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        <div>
          <Reveal>
            <div className="mb-5 flex items-center gap-2">
              <GameController size={22} className="text-accent" weight="fill" />
              <h2 className="text-xl font-bold">كل الألعاب</h2>
            </div>
          </Reveal>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {availableGames.map((game) => (
              <motion.div
                key={game.id}
                className="flex"
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
                }}
              >
                <GameCard
                  game={game}
                  to={game.route}
                  disabledReason={disabledGames.has(game.id) ? "الأدمن أوقف اللعبة دي مؤقتاً" : undefined}
                />
              </motion.div>
            ))}
          </motion.div>

          {comingSoonGames.length > 0 && (
            <div className="mt-8">
              <p className="mb-3 text-sm text-ink-muted">قريباً</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {comingSoonGames.map((game) => (
                  <GameCard key={game.id} game={game} variant="compact" />
                ))}
              </div>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
