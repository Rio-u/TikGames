export interface GameDefinition {
  id: string;
  nameAr: string;
  descriptionAr: string;
  emoji: string;
  /** Tailwind gradient stops shown behind the emoji until a real cover image is provided. */
  gradient: string;
  /**
   * Cover art, 1600×900 (16:9). Drop a matching file in apps/dashboard/public/games/ and it
   * appears automatically — missing files silently fall back to the gradient + emoji above.
   */
  imageUrl: string;
  /**
   * The game's own dedicated control page (settings + start + fullscreen view), built on
   * <GameControlShell>. Unset means "not built yet" — the library card renders as a disabled
   * "قريباً" preview instead of a link. This is the one place a new game gets wired into the
   * library once its page exists; nothing else in Dashboard.tsx needs to change.
   */
  route?: string;
}

export const GAMES: GameDefinition[] = [
  {
    id: "MUSICAL_CHAIRS",
    nameAr: "الكراسي الموسيقية",
    descriptionAr: "اللاعبين بيدخلوا بأمر معين، وكل جولة يكتبوا رقم الكرسي اللي عايزينه — واللي مالوش كرسي يُقصى لحد ما يفضل واحد بس.",
    emoji: "🪑",
    gradient: "from-amber-500/35 via-orange-600/20 to-canvas-elevated",
    imageUrl: "/games/musical-chairs.jpg",
    route: "/live/musical-chairs",
  },
  {
    id: "TRIVIA",
    nameAr: "أسئلة عامة",
    descriptionAr: "سؤال عام يظهر على خلفية بتتغير كل مرة، أول تعليق بالإجابة الصح ياخد نقطة، والفائز صاحب أعلى نقط.",
    emoji: "🧠",
    gradient: "from-blue-500/35 via-indigo-600/20 to-canvas-elevated",
    imageUrl: "/games/trivia.jpg",
    route: "/live/trivia",
  },
  {
    id: "GUESS_NUMBER",
    nameAr: "تخمين رقم أو كلمة",
    descriptionAr: "الستريمر يحط رقم أو كلمة سرية، والمشاهدين يخمنوا في الكومنتات.",
    emoji: "🔢",
    gradient: "from-emerald-500/35 via-teal-600/20 to-canvas-elevated",
    imageUrl: "/games/guess-number.jpg",
    route: "/live/guess-number",
  },
  {
    id: "SPIN_WHEEL",
    nameAr: "عجلة الحظ",
    descriptionAr: "اللاعبين يدخلوا بأمر، والعجلة تختار مين يطرد مين بالأرقام — في دروع مخفية 🛡️ وآخر ناجي يكسب.",
    emoji: "🎡",
    gradient: "from-fuchsia-500/35 via-purple-600/20 to-canvas-elevated",
    imageUrl: "/games/spin-wheel.jpg",
    route: "/live/spin-wheel",
  },
  {
    id: "WOULD_YOU_RATHER",
    nameAr: "إما / أو",
    descriptionAr: "خياران يظهروا على الشاشة، والمشاهدين يصوتوا بكتابة 1 أو 2 بشكل حي.",
    emoji: "⚖️",
    gradient: "from-violet-500/35 via-sky-600/20 to-canvas-elevated",
    imageUrl: "/games/would-you-rather.jpg",
    route: "/live/would-you-rather",
  },
  {
    id: "FLAGS",
    nameAr: "أعلام",
    descriptionAr: "عدد جولات وعلم يظهر كل مرة، أول تعليق باسم الدولة الصح ياخد نقطة، والفائز صاحب أعلى نقط.",
    emoji: "🏁",
    gradient: "from-rose-500/35 via-red-600/20 to-canvas-elevated",
    imageUrl: "/games/flags.jpg",
    route: "/live/flags",
  },
  {
    id: "CAPITALS",
    nameAr: "عواصم",
    descriptionAr: "علم واسم دولة يظهروا كل جولة، وأول تعليق بعاصمتها الصح ياخد نقطة، والفائز صاحب أعلى نقط.",
    emoji: "🧭",
    gradient: "from-cyan-500/35 via-sky-600/20 to-canvas-elevated",
    imageUrl: "/games/capitals.jpg",
    route: "/live/capitals",
  },
  {
    id: "LOGOS",
    nameAr: "شعارات",
    descriptionAr: "شعار ماركة مشهورة يظهر كل جولة، وأول تعليق باسمها الصح ياخد نقطة، والفائز صاحب أعلى نقط.",
    emoji: "🏷️",
    gradient: "from-amber-500/35 via-orange-600/20 to-canvas-elevated",
    imageUrl: "/games/logos.jpg",
    route: "/live/logos",
  },
  {
    id: "SPEED_WORD",
    nameAr: "أسرع",
    descriptionAr: "كلمة عربي أو إنجليزي تظهر على خلفية بتتغير كل مرة، أول تعليق يكتبها بالظبط ياخد نقطة، والفائز صاحب أعلى نقط.",
    emoji: "⚡",
    gradient: "from-yellow-500/35 via-amber-600/20 to-canvas-elevated",
    imageUrl: "/games/speed-word.jpg",
    route: "/live/speed-word",
  },
  {
    id: "MAZE",
    nameAr: "متاهة",
    descriptionAr: "اللاعبين يدخلوا بأمر ويتسابقوا جوه متاهة بكتابة أرقام من 1 لـ 4 — وكل واحد يقدر يحط فخ مخفي. أول واحد يوصل للكأس يكسب.",
    emoji: "🧩",
    gradient: "from-teal-500/35 via-emerald-600/20 to-canvas-elevated",
    imageUrl: "/games/maze.jpg",
    route: "/live/maze",
  },
];
