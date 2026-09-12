# نشر TikGames مجاناً (Vercel + Render + MongoDB Atlas)

المشروع 4 تطبيقات، مش تطبيق واحد، وعشان كده **ما ينفعش يترفع كله على Vercel**:

| التطبيق | نوعه | مكان النشر |
|---|---|---|
| `apps/dashboard` | موقع React ثابت | **Vercel** |
| `apps/overlay` | موقع React ثابت | **Vercel** |
| `apps/api` | سيرفر Express + Socket.io (حالة في الذاكرة) | **Render** |
| `apps/tiktok-connector` | خدمة دائمة تتصل بتيك توك | **Render** (نفس خدمة الـ api) |
| قاعدة البيانات | MongoDB (replica set) | **MongoDB Atlas** |

> **ليه مش Vercel للباك اند؟** Vercel serverless — دوال قصيرة بتقوم وتنام. الـ api بيعتمد على Socket.io
> (اتصالات دائمة) وحالة ألعاب في الذاكرة، ودول محتاجين عملية واحدة ثابتة شغالة على طول.

الترتيب مهم: **Atlas → Render → Vercel** (كل خطوة بتديك قيمة محتاجها في اللي بعدها).

---

## 0) ارفع الكود على GitHub

الملفات الجديدة (`Dockerfile.backend`, `render.yaml`, `scripts/start-backend.sh`, `apps/*/vercel.json`)
لازم تكون على GitHub الأول:

```bash
git add -A
git commit -m "Add production deploy config (Render + Vercel + Atlas)"
git push origin main
```

---

## 1) قاعدة البيانات — MongoDB Atlas (مجاني)

1. اعمل حساب على https://www.mongodb.com/cloud/atlas → أنشئ **Cluster** واختَر **M0 (Free)**.
2. **Database Access** → أضف مستخدم بـ username/password (احفظهم).
3. **Network Access** → أضف `0.0.0.0/0` (اسمح لأي IP — لأن IP بتاع Render بيتغيّر).
4. **Connect → Drivers** → انسخ رابط الاتصال، شكله:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxx.mongodb.net/tikgames?retryWrites=true&w=majority
   ```
   - حط اسم المستخدم والباسورد مكان `<user>:<password>`.
   - أضف `tikgames` كاسم القاعدة قبل الـ `?` (زي اللي فوق).
   - احتفظ بالرابط ده — هو الـ `DATABASE_URL`.
5. جهّز الجداول (schema). من جهازك، شغّل مرة واحدة:
   ```bash
   DATABASE_URL="mongodb+srv://...الرابط بتاعك..." pnpm db:push
   ```

---

## 2) الباك اند — Render (مجاني)

1. اعمل حساب على https://render.com واربطه بحساب GitHub.
2. **New → Blueprint** → اختَر ريبو `TikGames`. Render هيقرأ `render.yaml` تلقائياً ويعمل خدمة
   اسمها `tikgames-backend`.
3. قبل ما تعمل Deploy، املأ المتغيرات السرية (اللّي معلَّمة `sync: false`):
   - `DATABASE_URL` = رابط Atlas من خطوة 1.
   - `CORS_ORIGIN` = **سيبها فاضية دلوقتي** — هترجع تملأها في خطوة 4 بعد ما ياخد الـ Vercel روابط.
   - `DASHBOARD_URL` = هتملأها كمان في خطوة 4.
   - `EULER_STREAM_API_KEY` = مفتاح مجاني من https://www.eulerstream.com — لازم **للبث الحقيقي** من
     تيك توك. لو عايز تجرّب بس بالتعليقات الوهمية (`/live/simulate`) سيبها فاضية دلوقتي.
   - باقي المتغيرات (TikTok/Discord OAuth، Turnstile) اختيارية — سيبها فاضية.
   - `JWT_*` و`CONNECTOR_INTERNAL_SECRET` — Render بيولّدها تلقائياً، ما تلمسهاش.
4. اعمل **Deploy**. أول بناء بياخد 3-5 دقايق. لما يخلّص هتلاقي رابط الخدمة، شكله:
   `https://tikgames-backend.onrender.com` — **احفظه، ده رابط الـ API.**
5. تأكد إنه شغال: افتح `https://tikgames-backend.onrender.com/health` — لازم يرجّع
   `{"status":"ok",...}`.

> **ملاحظة الخطة المجانية:** الخدمة بتنام بعد ~15 دقيقة من غير زيارات، وأول طلب بعد كده بياخد
> ~30-60 ثانية عشان تصحى. طول ما فيه بث شغّال (الداشبورد/الأوفرلاي متصلين) بتفضل صاحية عادي.

---

## 3) الواجهات — Vercel (مجاني)

هتعمل **مشروعين منفصلين** على Vercel من نفس الريبو (واحد للداشبورد وواحد للأوفرلاي).

### أ) الداشبورد
1. https://vercel.com → **Add New → Project** → اختَر ريبو `TikGames`.
2. **Root Directory** → اضغط Edit واختَر `apps/dashboard`.
3. Framework هيتحدد تلقائياً كـ **Vite** (الإعدادات جاية من `apps/dashboard/vercel.json`).
4. **Environment Variables** → أضف:
   - `VITE_API_URL` = رابط Render من خطوة 2 (مثال: `https://tikgames-backend.onrender.com`).
   - `VITE_TURNSTILE_SITE_KEY` = اختياري (سيبها فاضية لو مش مفعّل الكابتشا).
5. **Deploy**. هتاخد رابط زي `https://tikgames-dashboard.vercel.app` — احفظه.

### ب) الأوفرلاي
كرّر نفس الخطوات بس:
1. **Add New → Project** → نفس الريبو `TikGames`.
2. **Root Directory** = `apps/overlay`.
3. Environment Variables → `VITE_API_URL` = **نفس** رابط Render.
4. **Deploy**. هتاخد رابط زي `https://tikgames-overlay.vercel.app` — احفظه.

---

## 4) اربط الاتنين ببعض (خطوة أخيرة مهمة)

دلوقتي عندك روابط الـ Vercel، ارجع لـ **Render → tikgames-backend → Environment** وحدّث:

- `CORS_ORIGIN` = رابطين Vercel مفصولين بفاصلة، من غير `/` في الآخر:
  ```
  https://tikgames-dashboard.vercel.app,https://tikgames-overlay.vercel.app
  ```
- `DASHBOARD_URL` = رابط الداشبورد:
  ```
  https://tikgames-dashboard.vercel.app
  ```

احفظ → Render هيعمل redeploy تلقائي. **لو نسيت `CORS_ORIGIN` الاتصال هيتبلوك** والداشبورد
مش هيوصله بيانات ولا الأوفرلاي هيشتغل.

---

## 5) جرّب إن كله شغّال

1. افتح رابط الداشبورد → اعمل حساب → سجّل دخول.
2. ابدأ live session (لو الخدمة نايمة، أول طلب هيصحّيها بعد شوية).
3. افتح صفحة تحكم أي لعبة → ابدأ اللعبة.
4. استخدم صفحة `/live/simulate` عشان تبعت تعليقات وهمية وتشوف اللعبة بتتفاعل على الداشبورد والأوفرلاي.
5. للأوفرلاي في OBS: استخدم رابط الأوفرلاي مع الـ token بتاع الغرفة (زي المحلي بالظبط).

---

## حدود الخطة المجانية (اعرفها من دلوقتي)

- **Render نوم بعد خمول:** أول طلب بعد الخمول بطيء. حل: خطة مدفوعة صغيرة، أو ping دوري (cron-job.org
  مجاني كل 10 دقايق على `/health`) عشان تفضّلها صاحية.
- **رفع الصور (خلفيات التريفيا):** ملفات Render المرفوعة **بتتمسح** مع كل redeploy (القرص مؤقّت). لو
  محتاج رفع صور ثابت، محتاج تخزين خارجي (S3/Cloudinary) لاحقاً.
- **Atlas M0:** 512 ميجا تخزين — كفاية للبداية.
- **البث الحقيقي من تيك توك:** محتاج `EULER_STREAM_API_KEY` (نسخة مجانية بحد استخدام). التعليقات
  الوهمية بتشتغل من غيره.

---

## ٦) البرنامج المكتبي (الـ exe) والترخيص

البرنامج المكتبي عميل خفيف — بيتكلم مع نفس الـ API اللي نشرته فوق على Render. فمحتاج بس تزوّد
شوية متغيرات على Render، وتبني الـ exe وهو مأشّر على روابطك المنشورة.

### أ) متغيّرات إضافية على Render

في **Render → tikgames-backend → Environment** زوّد:

- `LICENSE_PASSWORD` = الباسورد اللي هتديه للناس عشان يفعّلوا البرنامج. **فاضي = محدش يقدر يفعّل.**
- `LICENSE_AUTO_APPROVE` = سيبها فاضية عشان توافق على كل جهاز يدوي (المفضّل)، أو `1` لتفعيل تلقائي.
- `DISCORD_BOT_TOKEN` = توكن بوت ديسكورد (اعمله من https://discord.com/developers ← New Application
  ← Bot ← Reset Token). اعمل invite للبوت على سيرفرك بصلاحية `applications.commands`.
- `DISCORD_GUILD_ID` = آي دي سيرفر الديسكورد بتاعك (فعّل Developer Mode ← يمين على السيرفر ← Copy ID).
- `DISCORD_ADMIN_USER_IDS` = آي ديك في ديسكورد (وأي أدمن تاني)، مفصولين بفاصلة. **فاضي = محدش.**
- `LICENSE_JWT_SECRET` — Render بيولّده تلقائي، ما تلمسهوش.

احفظ → Render هيعمل redeploy. البوت بيشتغل تلقائي مع الـ API، ومحتاجش سيرفر منفصل.

بعد كده جرّب من ديسكورد: اكتب `/pending` — المفروض يرد عليك (لو مردّش، اتأكد إن آي ديك في
`DISCORD_ADMIN_USER_IDS` وإن البوت متضاف للسيرفر). أوامر البوت كلها في
[apps/desktop/README.md](apps/desktop/README.md).

### ب) بناء الـ exe على روابطك

من جهازك، بعد ما ياخد Render و Vercel روابطهم:

```bash
APP_API_URL="https://tikgames-backend.onrender.com" \
APP_DASHBOARD_URL="https://tikgames-dashboard.vercel.app" \
pnpm --filter @tikgames/desktop dist
```

المتغيرين دول بيتحطوا تلقائي في `config.json` قبل البناء (سكربت stamp-config)، فالـ exe يطلع
مأشّر على سيرفرك على طول. المثبّت هيظهر في `apps/desktop/release/TikGames Setup <version>.exe` —
ده اللي تبعته للناس.

> تنبيه: المثبّت مش موقّع رقمياً، فأول تشغيل ويندوز SmartScreen ممكن يحذّر — "More info → Run
> anyway". إزالة التحذير محتاجة شهادة توقيع كود مدفوعة.

### الخلاصة
1. انشر الـ API على Render (+ متغيرات الترخيص فوق) والداشبورد/الأوفرلاي على Vercel.
2. ابنِ الـ exe بالأمر اللي فوق.
3. ابعت الـ exe + الباسورد للشخص. هو يفتح، يكتب الباسورد، يستنى موافقتك من `/approve` في ديسكورد،
   ويلعب. وأنت تقدر تقفله أي وقت بـ `/kill`.
