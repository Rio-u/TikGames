# برومبت تعريفي بمشروع TikGames

> انسخ كل اللي تحت السطر ده وابعته لأي AI model عشان يفهم المشروع بالكامل.

---

أنت مساعد تقني هتشتغل على مشروع اسمه **TikGames**. اقرأ الوصف ده كويس قبل ما ترد على أي سؤال أو تكتب أي كود.

## الفكرة في جملة

منصة **ألعاب تفاعلية لبثوث TikTok Live**: الستريمر بيفتح لايف، يربط حسابه، يختار لعبة من مكتبة الألعاب، والمشاهدين بيلعبوا **بكتابة كومنتات في شات اللايف** — واللعبة بتتعرض على الاستريم كـ **Browser Source شفاف في OBS**.

## إزاي بتشتغل الدورة كاملة

1. الستريمر بيسجل دخول في الداشبورد ويربط قناة TikTok بتاعته → بيتعمل `LiveSession`.
2. بيختار لعبة من المكتبة ويظبط إعداداتها (عدد الجولات، مدة كل جولة، الأمر اللي المشاهد يكتبه للدخول... إلخ) → `POST /games/configs` بعدها `POST /games/session/start`، وده بيعمل صف `GameSession` وبيعمل instantiate لـ **engine** خاص باللعبة ويحطه في `activeEngines` في الميموري.
3. خدمة `tiktok-connector` بتتصل بغرفة اللايف عن طريق مكتبة `tiktok-live-connector` (بروتوكول TikTok الداخلي غير الرسمي)، وبتحوّل كل حدث (كومنت / هدية / لايك / follow) لـ `LiveEvent` موحّد وتبعته للـ API على Socket.io namespace داخلي مؤمّن بـ secret.
4. الـ API بيمرر كل كومنت لـ `engine.handleComment(handle, displayName, avatarUrl, text)` بتاع اللعبة الشغالة.
5. أي تغيير في حالة اللعبة بيستدعي `onChange` → بيحفظ `GameSession.state` في الداتابيز وبيبث `game:state` على namespace الـ `/dashboard` و `/overlay`.
6. الواجهتين (داشبورد الستريمر + الأوفرلاي بتاع OBS) **مجرد renderers** لنفس الـ `state` object — ولا واحدة فيهم فيها أي منطق لعبة إطلاقًا.

**النتيجة المعمارية المهمة:** إضافة لعبة جديدة = كلاس engine جديد + كومبوننتين عرض. الترانسبورت والسوكتس والـ lifecycle مش بيتغيروا أبدًا.

## الأدوار الثلاثة

- **الستريمر** — يسجل، يربط TikTok، يختار لعبة، يظبط إعداداتها، يبدأ/يوقف، ويشوف الشات واللوحة والمتصدرين في صفحة تحكم fullscreen.
- **المشاهد** — مش بيسجل دخول ولا بيفتح الموقع أصلًا. بيلعب من شات TikTok بس. بيتعرّف عليه بالـ `handle` بتاعه، وبتتبنى له نقاط وترتيب تراكمي (`ViewerRanking`) عند الستريمر ده.
- **الأدمن** — لوحة تحكم على مسار `/d7admind7`: تفعيل/تعطيل أي لعبة (kill switch)، إدارة الاشتراكات والمدفوعات، محتوى الألعاب (أسئلة، صور خلفيات، تراكات صوت)، تنبيهات النظام، وسجل نشاط كامل لكل إجراء أدمن (`AdminActionLog`).

## الألعاب (12 لعبة، كلها متبنية وشغالة)

| # | اللعبة | الفكرة |
|---|---|---|
| 1 | الكراسي الموسيقية `MUSICAL_CHAIRS` | اللاعبين بيدخلوا بأمر، وكل جولة يكتبوا رقم كرسي — اللي مالوش كرسي يُقصى لحد ما يفضل واحد |
| 2 | أسئلة عامة `TRIVIA` | سؤال على خلفية بتتغير، أول كومنت بالإجابة الصح ياخد نقطة |
| 3 | تخمين رقم أو كلمة `GUESS_NUMBER` | الستريمر يحط قيمة سرية والمشاهدين يخمنوا في الكومنتات |
| 4 | عجلة الحظ `SPIN_WHEEL` | العجلة تختار مين يطرد مين، فيه دروع مخفية وآخر ناجي يكسب |
| 5 | إما / أو `WOULD_YOU_RATHER` | خيارين على الشاشة والتصويت بكتابة 1 أو 2 بشكل حي |
| 6 | أعلام `FLAGS` | علم يظهر كل جولة، أول كومنت باسم الدولة الصح ياخد نقطة |
| 7 | عواصم `CAPITALS` | علم + اسم دولة، وأول كومنت بالعاصمة الصح ياخد نقطة |
| 8 | شعارات `LOGOS` | شعار ماركة، وأول كومنت باسمها الصح ياخد نقطة |
| 9 | أسرع `SPEED_WORD` | كلمة عربي/إنجليزي تظهر، وأول واحد يكتبها بالظبط ياخد نقطة |
| 10 | متاهة `MAZE` | سباق جوه متاهة بكتابة أرقام 1–4، وكل لاعب يقدر يحط فخ مخفي |
| 11 | تحدي الرسم `DRAWING` | الستريمر يرسم كلمة سرية والشات يخمنها |
| 12 | جولة كلمات `WORD_ROUND` | حرف مميز + حروف زيادة، واللي يكتب كلمة صحيحة فيها الحرف ياخد نقط على قد طولها |

## الستاك التقني

**Monorepo بـ pnpm workspaces**، TypeScript في كل حتة:

```
apps/
  api/                Express 4 + Socket.io 4 + Prisma — كل منطق الألعاب والأوث والبث الحي
  dashboard/          React 18 + Vite 5 + Tailwind + Framer Motion + react-three-fiber
  overlay/            React 18 + Vite 5 — صفحة OBS، خلفية شفافة، read-only، مقيدة بتوكن
  tiktok-connector/   خدمة مستقلة، wrapper حوالين tiktok-live-connector
packages/
  shared-types/       المصدر الوحيد لكل عقد مشترك (شكل حالة كل لعبة + أسماء أحداث السوكت)
  database/           Prisma schema — MongoDB, relationMode = "prisma"
  config/             tsconfig مشترك
```

- **الداتابيز**: MongoDB (لازم replica set حتى لو single-node عشان Prisma transactions)
- **الأوث**: bcryptjs + JWT (access + refresh)، مع OAuth لـ TikTok و Discord، و Cloudflare Turnstile اختياري كـ CAPTCHA
- **البورتات محليًا**: API `4000` · Dashboard `5173` · Overlay `5174` · MongoDB `27018`
- **راوتس الـ API**: `/auth` · `/live` · `/games` · `/leaderboard` · `/uploads` · `/admin`
- **Socket.io namespaces**: `/internal` (الكونكتور) · `/dashboard` (الستريمر) · `/overlay` (OBS)

## نموذج البيانات (أهم الموديلز)

`User` · `RefreshToken` · `TikTokAccount` · `DiscordAccount` · `Subscription` · `Payment` · `LiveSession` · `GameConfig` · `GameSession` · `GameSessionParticipant` · `Alert` · `AdminActionLog` · `GameToggle` · `GameContent` · `ViewerRanking` · `RedemptionCode` · `TriviaBackgroundImage` · `SpeedWordBackgroundImage` · `MusicalChairsTrack` · `HomepageSettings` · `PlatformSettings` · `AuthMethodToggle`

## نموذج العمل

كل حساب جديد بياخد **تجربة مجانية كاملة 3 أيام** أوتوماتيك (`Subscription.status: TRIAL`)، وبعدها `ACTIVE` / `EXPIRED` / `SUSPENDED`. التحويل لاشتراك مدفوع دلوقتي **إجراء أدمن يدوي** (`Payment.provider = MANUAL`)، بس الـ schema فيها `PAYMOB` و `PAYTABS` جاهزين لربط بوابة دفع حقيقية بعدين من غير إعادة هيكلة. المبالغ متخزنة كـ `Int` بالوحدة الصغرى (قروش) لأن Mongo مافيهاش `Decimal` في Prisma.

## قواعد ومبادئ لازم تحترمها

1. **كل حاجة تظهر للمستخدم عربي و RTL.** أي اسم مستخدم جاي من TikTok لازم يتلف في `<bdi>` — الهاندلز ممكن تكون لاتيني أو عربي، والنص ثنائي الاتجاه جنب واجهة RTL ثابتة بيتكسر من غير `<bdi>`.
2. **السيرفر هو مصدر الحقيقة الوحيد للوقت.** كل انتقال بين مراحل اللعبة بيتم بـ `setTimeout` في الـ engine، وبيحط `phaseEndsAt` (ISO) قبل ما يبث — العميل بيعد تنازلي من التايمستامب ده، مش من تايمر محلي.
3. **إدخال الشات غير موثوق بطبيعته.** أي كومنت غلط أو متأخر أو مكرر = **no-op صامت**، مش exception.
4. **مفيش فلترة لكل namespace.** `game:state` بيتبعت **بنفس الـ payload بالظبط** للداشبورد والأوفرلاي. يعني أي قيمة سرية (زي كلمة "تخمين" السرية) **ممنوع** تحطها في `state.settings` — لازم تبقى حقل منفصل مكشوف بس لما `phase === "FINISHED"`.
5. **إعادة الاتصال بالسوكت.** أي صفحة بتعمل `socket.emit("join", liveSessionId)` لازم تعيدها في event الـ `"connect"` كمان، مش مرة واحدة عند الـ mount — رووم socket.io مابتنجاش من الـ reconnect.
6. **إعادة الاستخدام قبل الاختراع.** فيه كومبوننتس مشتركة جاهزة: `GameControlShell` · `WinnerCelebration` · `NoWinnerScreen` · `ChatBox`/`ChatStrip` · `PlayerAvatar` · `useCountdown`. متعملش نسخة تانية منهم.
7. **التجريد بعد الاستخدام التاني، مش قبله** — قاعدة مقصودة في المشروع: متعملش abstraction للعبة ثالثة لسه مش موجودة.
8. **مقارنة النصوص العربية** بتتم عن طريق `normalizeAnswer()` (بيوحّد الألف والتاء المربوطة والألف المقصورة، ويشيل التشكيل والترقيم) — مش `===` عادي.

## أهم مخاطرة في المشروع

TikTok **مالهاش API رسمي** لقراءة كومنتات اللايف في الوقت الحقيقي. المشروع معتمد على `tiktok-live-connector` (مفتوحة المصدر، MIT) اللي بتتكلم بروتوكول WebCast الداخلي غير الموثّق، ومحتاجة خدمة "signing" خارجية (Euler Stream) عشان تولّد توكنات على كل اتصال.

يعني: **ده ممكن يقع في أي لحظة من غير إنذار.** عشان كده الكونكتور مصمم إنه **يفشل بصوت عالي، مش بصمت** — أي خطأ اتصال أو فشل توقيع بيبعت `connector:alert` فورًا، الـ API بيحفظه كـ `Alert` وبيظهر في لوحة الأدمن. وفيه heartbeat (`LiveSession.lastHeartbeatAt`) عشان نكشف كونكتور وقف يستقبل أحداث من غير ما يرمي خطأ.

كمان التكامل كله واقف ورا واجهة `LiveSourceConnector` عشان يتضاف مصدر تاني بعدين (زي Kick اللي عندها API حقيقي وموثّق) من غير ما نلمس `apps/api`.

## تشغيل محلي

```bash
pnpm install
# انسخ .env.example → .env في: packages/database و apps/{api,dashboard,overlay,tiktok-connector}
start-mongo.bat      # MongoDB على بورت 27018 + replica set rs0
pnpm db:push         # Prisma db push — مفيش migrations في Mongo
start.bat            # يشغّل: MongoDB + api + tiktok-connector + dashboard + overlay
```

مفيش test framework متركب — التحقق يدوي بس المفروض يكون حقيقي: `tsc --noEmit` أولًا، وبعدين سكربت Node واحد ذري بيستخدم `fetch` + `socket.io-client` على الـ dev API (تسجيل حساب مؤقت → بدء لايف → بدء لعبة → إرسال كومنتات محاكاة عن طريق `/live/:id/simulate-comment` → التأكد من بثوث `game:state`). سكربت واحد أحسن من أوامر متفرقة لأن التأخير بين الاستدعاءات بيكفي إنه يفوّت نافذة مرحلة قصيرة ويدي نتيجة خاطئة.

كمان فيه صفحة `/live/simulate` في الداشبورد بتحاكي كومنتات المشاهدين وبتعدّي على **نفس مسار الكود بالظبط** — فتقدر تجرب كل الألعاب من غير لايف TikTok حقيقي.

---

**دلوقتي:** لما أسألك عن أي حاجة في المشروع ده، رد على أساس الفهم ده. اسألني لو محتاج توضيح، ولو هتقترح كود خلي أسلوبه متسق مع اللي فوق.
