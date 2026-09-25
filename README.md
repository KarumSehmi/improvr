# 🔥 Improvr

Your daily checklist, streaks, calendar and accountability app. Built as a website that installs to your iPhone home screen like a real app (and works on your computer too).

> *Just try to be better than you were yesterday.*

## What's in it

- **Today** – your daily checklist, grouped into Morning / Through the day / Room / Night / Stayed clean. Takes about 2 minutes, and you can fill it in bit by bit through the day. It follows the clock: the sky changes from dawn to night, and sections that aren't due yet (Night in the morning, say) fold away as "later" until their time.
  - **☀️ Three check-ins a day** – morning, afternoon and evening. Open the app in each window and tap how your energy is: +5 XP each, +15 bonus for all three (a *hat-trick*). Miss the window and it's gone.
  - **🏁 Race yesterday-you** – "2 ahead of yesterday" means you've ticked off more than you had by this exact time yesterday. The yellow dot on the ring is yesterday-you, moving through the day.
  - **🎲 Bonus quest** – one small optional challenge a day (a walk, 10 pages, a cold finish to your shower…) for +15 XP. You can swap it once.
  - **🎁 Reward chest** – lock the day in on time and you open a chest: 10, 20, 40 or (rarely) 75 XP. A perfect day gets a golden chest with better odds.
  - **Rings at the top** show every section at a glance. Tap one to jump to it.
  - **App icon badge** – the Home Screen icon shows how many things are due right now (with notifications switched on).
  - **⚡ Up next** looks at the time and tells you what matters *now*: one tap for the whole morning routine, a countdown to the 2pm caffeine cutoff, water reminders, "need 2 more gym sessions in 3 days", overdue jobs, streaks at risk tonight, time left until 1am, and what's on tomorrow.
  - **One-tap "All ✓" / "All clean"** per section, with **Undo**.
  - Weigh-in, sleep before 1am and up before 9am (tap ✕ to enter a rough time from your Apple Watch), pills, teeth morning and night, AM/PM face routine, finasteride every 3 days (ml → mg worked out for you; change how often in More → Settings), 2 water bottles, MacroFactor, protein.
  - Room chores **carry over** in orange until you do them: clothes, glasses, rubbish (daily), bin (every 3 days), surfaces (Wed), bathroom deep clean (Thu), hoover & mop (Sat). Bud + Canvas on Tuesdays, pill organiser refill every other Sunday.
  - Paula's Choice every 3 days, skip it whenever you like.
  - Stayed clean: nicotine, porn, alcohol, caffeine after 2pm — answer *Clean* or *Slipped* honestly.
  - Training: aim for 3 sessions a week. Gym gives the most XP, home workouts and football count too. Football Mondays are optional.
  - **Reflect**: a one-tap mood and a "how can I be better tomorrow?" note, which shows up the next morning.
  - The score ring has a yellow dot for **yesterday's score**. The goal is always to beat it.
- **Dopamine** – animated checks, iPhone haptic taps, little sounds (the silent switch mutes them; turn them off in Settings), "+XP" pop-ups, confetti, a 🔥 streak on every habit, level-ups and 36 badges to unlock.
- **🧠 Insights** – patterns found in your own data. For example: "after nights asleep before 1am you get 86% of your list done vs 61%", "nicotine slips are 3x more likely after a late night", "most alcohol slips land on Saturdays", "you feel better on training days", and "your best day is Tuesday".
- **📊 Weekly review** – every Monday you get a report card for last week (grade, vs the week before, what you smashed and what needs work), and you pick **one focus habit** for the week, which gets pinned on Today.
- **Calendar** – add any events, plus friends' birthdays (they show on the calendar and on Today when they're coming up).
- **💳 Card spending** – once a week, type in what you've spent on your credit card so far this month (+10 XP). It shows a bar against your **£800 limit** (well under £1,000) with a pace marker, and tells you straight: on track and what you can spend a day/week, or how far ahead of pace you are, what to keep it to, and how much a week to cut to make it to the end of the month. Sunday evening reminder if you haven't updated it. Change the limit or the day your card's month starts in More → Settings.
- **📝 To-dos** – jobs on the calendar. Anything not done on its day carries over to today (and shows how many days late) until you tick it off. They can **repeat** (e.g. the haircut every 2 weeks: tick it off and the next one comes up 14 days later). Add them from Today or the Calendar.
- **Progress** – insights, this week vs last week, score heatmap, badges, slip counts, habit streaks, gym sessions per week, sleep, finasteride, your notes.
- **🔔 Reminders** – adds repeating alerts to your iPhone Calendar (morning check-in, caffeine cutoff, lock-in, bedtime, weekly jobs, birthdays), since websites can't send iPhone notifications without a server.
- **✏️ Your habits** – add your own habits, switch any off, move chore days, and set how often daily ones are due (every day, every 3 days, weekly…), all inside the app (More → Your habits). Changing how often never rewrites past days.
- **🔔 Smart notifications** – when something needs doing: morning routine not done, to-dos still open at midday, afternoon and evening check-ins (with what's left right now), caffeine cutoff coming, today not locked in (with streaks at risk), yesterday not logged, last call before a fine, bedtime, fines owed, weekly review. Each one can be switched off.
- **💪 Urges beaten + 💰 money saved** – tap "beat an urge" when a craving passes (+5 XP). Set what nicotine etc. costs you per week and see £ saved.
- **🍺 Alcohol allowance** – 1 drinking night a week is allowed by default (change it in Your habits). The second one counts as a slip.
- **⌚ Apple Watch sleep** – an iPhone Shortcut fills in "asleep before 1am / up before 9am" every morning with the actual times and how long you slept; Progress shows your average sleep and bedtime.
- **More** – fines (with a one-tap donate link), notifications, Apple Watch, habits, the rules, settings, sync and backup.

## The rules (lenient but strict)

1. **Log every day.** Hit *Lock in* by **midnight at the end of the next day** (a 24h grace period). If you miss it, you owe **£5 to charity** for that day. The app tells you what you owe, and you mark it paid once you've donated. That's the only punishment.
2. **One day off per week** (Mon–Sun). Streaks freeze, nothing counts against you, and it counts as logged.
3. **Tick everything and the day locks itself**, plus you get a perfect-day bonus. Locking in on time opens a reward chest.
4. Chores carry over until done. Slips never cost money; they just reset that streak.

---

## Setup (about 10 minutes, once)

### 1. Put it online (Vercel, free)

1. Go to <https://vercel.com>, sign in with GitHub and click **Add New → Project**.
2. Import the `improvr` repo and click **Deploy**. Vercel detects Vite on its own, so there's nothing to configure.
3. You get a URL like `improvr-xyz.vercel.app`. Every push to the repo redeploys it automatically.

At this point it works in **local mode**: your data is saved on that one device only. To sync your phone and computer, do step 2.

### 2. Sync between phone and computer (Firebase, free)

1. <https://console.firebase.google.com>: **Create a project** (you can turn Analytics off).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (production mode, any region near you, e.g. `europe-west2`).
4. In Firestore, open the **Rules** tab, paste in the contents of [`firestore.rules`](firestore.rules) and click **Publish**. This means only you can read your data.
5. **Project settings (⚙️) → Your apps → Web (`</>`)**: register an app (no hosting needed). Copy the `firebaseConfig` values into [`src/firebaseConfig.ts`](src/firebaseConfig.ts).
6. Commit and push. Vercel redeploys, then open the site and tap **"First time? Create my account"**.

The Firebase config values aren't secret. Your data is protected by your login plus the rules from step 4. (Optional: once you've made your account, you can switch off new sign-ups under Authentication → Settings → User actions.)

If you already logged some days in local mode, use **More → Export backup** before switching over, then **Import backup** once you're signed in.

### 3. Install it on your iPhone

Open the site in **Safari → Share → Add to Home Screen**. It then opens full-screen like an app, works offline and syncs when it has signal.

### 4. Your own domain (improvr.karum.co.uk)

Put Improvr on a subdomain so it doesn't touch the main karum.co.uk site.

1. **Vercel** → your project → **Settings → Domains** → type `improvr.karum.co.uk` → **Add**. Vercel then shows a **CNAME** record to create. Leave that page open.
2. **GoDaddy** → **Domain Portfolio** → `karum.co.uk` → **DNS** → **Add New Record**:
   - Type: **CNAME**
   - Name: **improvr**
   - Value: the target Vercel showed (usually `cname.vercel-dns.com`)
   - TTL: leave the default
   Save. Don't change the existing `@` / `www` records, because those are your main site.
3. Back in Vercel, wait for the domain to turn green (a few minutes, occasionally up to an hour). HTTPS is set up automatically.
4. On your iPhone, open **https://improvr.karum.co.uk** in Safari → Share → **Add to Home Screen** (delete any old home-screen icon from the vercel.app address first), then sign in.

---

## Extras (all optional, all free)

These need one "server key" from Firebase. Get it once and paste it in two places.

**Get the key:** Firebase console → ⚙️ **Project settings** → **Service accounts** → **Generate new private key**. A `.json` file downloads. Open it and copy everything. ⚠️ Keep it secret: never commit it or post it anywhere.

### 🔔 Smart notifications

1. Vercel → your project → **Settings → Environment Variables** → add `FIREBASE_SERVICE_ACCOUNT` with the whole JSON (skip if you've done it for Apple Watch sleep) → **Redeploy**.
2. On your iPhone, open Improvr **from the Home Screen icon** → More → Notifications → **Turn on notifications** → Allow.
3. Same card → **Set up the timer** → copy your timer link. At [cron-job.org](https://cron-job.org) (free) → **Create cronjob** → paste it as the URL → every **5 minutes** → Create. The card turns green within 5 minutes.

Backup timer: add the same JSON as a GitHub secret (repo → **Settings → Secrets and variables → Actions** → `FIREBASE_SERVICE_ACCOUNT`) and the **Notify** workflow also checks every 15 minutes — GitHub often runs it hours late, which is why cron-job.org is the main one. Both at once is fine; nothing gets sent twice. To test: Actions → **Notify** → **Run workflow** → tick *Send a test notification*.

> GitHub pauses scheduled jobs on public repos after 60 days with no commits (Actions → Notify → **Enable workflow**). cron-job.org pauses a job after lots of failures — the card tells you if the timer stops.

### ⌚ Apple Watch sleep (Vercel)

1. Vercel → your project → **Settings → Environment Variables** → add `FIREBASE_SERVICE_ACCOUNT` with the same JSON → Save → **Deployments → ⋯ → Redeploy**.
2. In the app: More → Apple Watch sleep → **Set it up** (it shows your personal key and URL to copy), then build this 2-action Shortcut:
   - **Find Health Samples**: Type *is Sleep*, Start Date *is in the last 1 day* (it picks out last night itself, ignoring naps and yesterday's lie-in).
   - **Get Contents of URL**: the URL, Method **POST**, Request Body **JSON**, three Text fields: `key` → your key · `asleep` → Health Samples → **Start Date** · `awake` → Health Samples → **End Date**.
   - Automation → Alarm *Is Stopped* → Run Immediately.

---

## Changing things

Most things can be changed inside the app: **More → Your habits** (add, switch off, move chore days, how often) and **More → Settings** (fine amount, charity, donate link, gym target, card limit, finasteride). The built-in habits and their XP values live in **[`src/lib/config.ts`](src/lib/config.ts)** if you want to change those.

## Running locally

Needs Node **20.19+** or **22.12+** (`node -v` to check). Run `npm install` once after cloning; until you do, VS Code shows "Cannot find type definition file for 'vite/client'" errors.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # logic tests (streaks, fines, day off, insights, badges, notifications, sleep)
npm run build
```

Built with Vite + React + [Mantine](https://mantine.dev) (UI, calendar, charts), Motion (animations), ios-haptics, ics (calendar reminders), Firebase (login + database), web-push + Vercel functions + cron-job.org (notifications, Apple Watch sleep), GitHub Actions (backup timer), Zustand, dayjs, canvas-confetti, Plus Jakarta Sans and vite-plugin-pwa.
