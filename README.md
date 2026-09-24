# 🔥 Improvr

Your daily checklist, streaks, calendar and accountability app. Built as a website that installs to your iPhone home screen like a real app (and works on your computer too).

> *Just try to be better than you were yesterday.*

## What's in it

- **Today** – your daily checklist, grouped into Morning / Through the day / Room & jobs / Night / Stayed clean. Takes about 2 minutes, and you can fill it in bit by bit through the day.
  - Weigh-in, sleep before 1am and up before 9am (tap ✗ to enter a rough time from your Apple Watch), pills, AM/PM face routine, finasteride (ml → mg worked out for you), 2 water bottles, MacroFactor, protein.
  - Room chores **carry over** in orange until you do them: clothes, glasses, rubbish (daily), bin (every 3 days), surfaces (Wed), bathroom deep clean (Thu), hoover & mop (Sat). Bud + Canvas on Tuesdays, pill organiser refill every other Sunday.
  - Paula's Choice every 3 days, skip it whenever you like.
  - Stayed clean: vaping, porn, alcohol, caffeine after 2pm — answer *Clean* or *Slipped* honestly.
  - Training: aim for 3 sessions a week. Gym gives the most XP, home workouts and football count too. Football Mondays are optional.
  - A "how can I be better tomorrow?" note, which shows up the next morning.
- **XP, levels, streaks, confetti** – every habit has its own 🔥 streak, and there's a logging streak, a vape-free streak and a weekly gym streak.
- **Calendar** – add any events, plus friends' birthdays (they show on the calendar and on Today when they're coming up).
- **Progress** – score heatmap, slip counts (7 days / 30 days / days since), habit streaks and 30-day %, weight chart, gym sessions per week, sleep, finasteride, your notes.
- **More** – fines, the rules, settings, sync and backup.

## The rules (lenient but strict)

1. **Log every day.** Hit *Lock in* by **midnight at the end of the next day** (a 24h grace period). If you miss it, you owe **£5 to charity** for that day. The app tells you what you owe, and you mark it paid once you've donated. That's the only punishment.
2. **One day off per week** (Mon–Sun). Streaks freeze, nothing counts against you, and it counts as logged.
3. **Tick everything and the day locks itself**, plus you get a perfect-day bonus.
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

---

## Changing things

Everything you track is in **[`src/lib/config.ts`](src/lib/config.ts)**: labels, emojis, points, which section each habit is in, and chore schedules (`{ every: 3 }` = every 3 days after you last did it, `{ weekday: 6 }` = Saturdays). The fine amount, charity, gym target and finasteride settings are in the app under **More → Settings**.

## Running locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # logic tests (streaks, carry-over, fines, day off)
npm run build
```

Built with Vite + React + [Mantine](https://mantine.dev) (UI, calendar, charts), Firebase (login + database), Zustand, dayjs, canvas-confetti and vite-plugin-pwa.
