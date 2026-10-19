# 🎓 TMMBA Team Tracker — Setup Guide

A real-time shared assignment tracker for TMMBA teams (Seattle Melt and Sixth Sense).
Built with React + Supabase. Free to host, real-time sync for all 6 members.

---

## ⏱ Setup Time: ~15 minutes

---

## STEP 1 — Create a free Supabase project

1. Go to https://supabase.com and sign up
2. Click **New Project**
3. Name it: ``
4. Choose **US** region
5. Set a database password and save it
6. Wait ~2 minutes for your project to provision

---

## STEP 2 — Set up the database

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase-setup.sql` from this folder
4. Copy the entire contents and paste into the SQL Editor
5. Click **Run** (green button)
6. You should see "Success. No rows returned

---

## STEP 3 — Get your API credentials

1. In your Supabase dashboard, go to **Settings → API**
2. Copy your **Project URL** (looks like `https://xxxx.supabase.co`)
3. Copy your **anon public** key (long string starting with `eyJ...`)

---

## STEP 4 — Configure the app

1. In the `project` folder, create `.env.local`:
2. Open `.env.local` and fill in your values:
   ```
   REACT_APP_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGci...your-full-key-here
   ```
---

## STEP 5 — Test locally (optional)

Make sure you have Node.js 18+ installed, then:
```bash
cd project
npm install
npm start
```
Opens at http://localhost:3000

---

## STEP 6 — Deploy app
---
<<<<<<< HEAD

## STEP 7 — Share with the team

Send the Netlify URL to everyone:
> Ranjith, Jane, Shubham, Yu, Galen, Chris

**No login required** — the URL is the password. Consider using a custom domain
(free on Netlify) like `smelt-mba.netlify.app` for easy sharing.

Add it to your phone home screen:
- **iPhone:** Safari → Share → Add to Home Screen
- **Android:** Chrome → ⋮ menu → Add to Home Screen

---

## Features

- 📊 **Dashboard** — progress, overdue count, upcoming tasks, meetings
- 📝 **Tasks** — assignments + discussions, grouped by course, mark done
- 📚 **Courses** — manage courses with Canvas links and color coding
- 🎥 **Meetings** — Teams meeting links with one-tap join
- 👥 **Team** — workload view per team member
- ⚡ **Quarters** — add new quarters each term, switch between them
- 🔄 **Real-time** — changes appear instantly for all members

---

## Quarterly Workflow

At the start of each quarter:
1. Tap ⚡ in the app header
2. Add a new quarter (e.g. "Fall 2025")
3. Add your courses for that quarter
4. Add assignments as they're posted on Canvas

---

## Troubleshooting

**"Connection error"** — Check your `.env.local` Supabase keys are correct

**Changes not syncing** — Make sure Realtime is enabled in Supabase:
- Go to **Database → Replication** and enable all 4 tables

**Deployed but not working** — Check Netlify environment variables are set
(Settings → Environment variables — they don't auto-import from .env.local)

---

Made for Seattle Melt MBA Team 🏔️

---

## Teams

Teams are defined in `src/lib/constants.js` (`TEAMS`). Each quarter belongs to one team,
and courses, tasks and meetings follow their quarter. Use the switcher under the team name
to change teams; the choice is remembered on each device.

**Existing database:** run `supabase-teams-migration.sql` once in the Supabase SQL Editor.
It adds the `team` column; existing quarters stay with Seattle Melt.

To rename a team, change its `name` (keep the `id` the same).

---

## Reminders (email or text)

**Due-date reminders (automatic):** once someone signs in, they get one reminder
a day at 9:00 AM, starting 7 days before each open assignment is due through the
due date, by email. Each message lists everything due in that window. Finished
assignments stop reminding. Tap the 🔔 at the top to change it: how many days
before, extra times of day (each time = one more reminder a day), email and/or
text, only assignments assigned to you, or turn it off.

**Choosing assignments:** in 🔔 Reminder settings, "Which assignments" can be all,
only ones assigned to you, or only the ones you pick, and the list below it lets
you tick assignments on or off. Each assignment's **🔔 Remind me** screen also has
an on/off switch. Reminder emails include each assignment's description (its
Notes), due date and Canvas link.

**Extra one-time reminders:** open an assignment and tap **🔔 Remind me**, or tap
**Remind me** on a course, to add as many one-off reminders as you want.
Reminders need sign-in: people enter their email and get a one-time login link
(no passwords). Reminders only ever go to the signed-in person's own verified
email or phone, so nobody can send reminders to someone else. The rest of the
dashboard still works without signing in.

### 1. Turn on sign-in
1. Supabase → **Authentication → Sign In / Providers** → make sure **Email** is on.
2. **Authentication → URL Configuration**:
   - Site URL: `https://smeltdashboard.netlify.app`
   - Redirect URLs: add `https://smeltdashboard.netlify.app/**` and `http://localhost:3000/**`

### 2. Create the reminder tables
In the SQL Editor, run these two files in order:
1. `supabase-reminders.sql`: only the top part (everything above the SCHEDULE section)
2. `supabase-assignment-reminders.sql`: the whole file
3. `supabase-reminder-picks.sql`: the whole file (lets people pick which assignments remind them)

### 3. Set up email sending (Resend)
1. Sign up at https://resend.com and create an API key.
2. Verify a domain you own under **Domains** (a `netlify.app` address won't work).
   Until you do, Resend only delivers to your own Resend account email, which is
   fine for testing.

### 4. Deploy the sender function
From the `smelt-mba` folder:
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set CRON_SECRET=pick-a-long-random-string
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set REMINDER_FROM_EMAIL="SMELT Reminders <reminders@yourdomain.com>"
supabase secrets set APP_URL=https://smeltdashboard.netlify.app
supabase functions deploy send-reminders --no-verify-jwt
```
`--no-verify-jwt` is intentional: the function checks `CRON_SECRET` instead.

### 5. Run it every minute
1. **Database → Extensions** → enable `pg_cron` and `pg_net`.
2. In `supabase-reminders.sql`, uncomment the SCHEDULE block, fill in your project
   ref and the same `CRON_SECRET`, and run it.

### 6. Text reminders (optional)
Texting needs Twilio. Without it, the **Text** option asks for a phone number but
the code can't be delivered, so stick to email until this is set up.
1. Create a Twilio account and buy a phone number. US numbers sending app texts
   need A2P 10DLC registration (Twilio walks you through it).
2. Supabase → **Authentication → Sign In / Providers → Phone** → turn on, choose
   Twilio, enter your Account SID, Auth Token and number. This sends the
   verification code when someone adds their phone.
3. Give the sender function the same credentials:
   ```bash
   supabase secrets set TWILIO_ACCOUNT_SID=ACxxx TWILIO_AUTH_TOKEN=xxx TWILIO_FROM_NUMBER=+12065550123
   ```

### Test it
Sign in, set a reminder 2 minutes out, and wait. If nothing arrives, check
**Edge Functions → send-reminders → Logs**, or the `last_error` column in the
`reminders` table.
=======
>>>>>>> a170555b8de634ee58fd76b511dc8c801a72f8d2

---

## Telegram reminders (free, no email needed)

People can get reminders in Telegram instead of (or as well as) email. In the bell
→ Reminder settings they can choose **Use Telegram instead (no email needed)**, or
tick **Telegram** if already signed in, then tap **Connect Telegram** and **Start**
in the bot. Only their Telegram chat ID and display name are stored. Sending
`/stop` to the bot turns it off.

1. In Telegram, message **@BotFather** → `/newbot` → pick a name (e.g. *SMELT Reminders*)
   and a username ending in `bot` (e.g. `SmeltRemindersBot`). Copy the **token**.
2. Supabase → **Authentication → Sign In / Providers** → turn on **Allow anonymous sign-ins**
   (this is what "no email needed" uses).
3. Run `supabase-telegram-teams.sql` in the SQL Editor.
4. In PowerShell (one line at a time):
   ```powershell
   npx supabase@latest secrets set TELEGRAM_BOT_TOKEN=PASTE_TOKEN
   npx supabase@latest secrets set TELEGRAM_WEBHOOK_SECRET=PASTE_A_NEW_RANDOM_STRING
   npx supabase@latest functions deploy telegram-webhook --no-verify-jwt
   npx supabase@latest functions deploy send-reminders --no-verify-jwt
   ```
5. Tell Telegram where the bot lives (same token and secret as above):
   ```powershell
   Invoke-RestMethod "https://api.telegram.org/botPASTE_TOKEN/setWebhook?url=https://YOUR_PROJECT_REF.supabase.co/functions/v1/telegram-webhook&secret_token=PASTE_SAME_RANDOM_STRING"
   ```
   It should answer `ok: True` and "Webhook was set".
6. Add the bot username to the app:
   - `.env.local`: add a line `REACT_APP_TELEGRAM_BOT=SmeltRemindersBot`, then restart `npm start`
   - Netlify → **Site configuration → Environment variables**: add the same, then redeploy

## Teams channel: "due tomorrow" post

Each morning (9:00 AM Pacific by default) the app posts one message per team to a
Teams channel listing everything due the next day, with times, who it's for, and
Canvas links. Nobody's personal info is needed.

1. In Teams, open the team channel → **⋯** → **Workflows** → choose
   **"Post to a channel when a webhook request is received"** → follow the steps and
   copy the **URL** it gives you.
2. In PowerShell:
   ```powershell
   npx supabase@latest secrets set TEAMS_WEBHOOK_SEATTLE_MELT="PASTE_URL"
   npx supabase@latest secrets set TEAMS_WEBHOOK_MALAMUTES="PASTE_URL_FOR_SIXTH_SENSE"
   ```
   (Sixth Sense keeps the internal id `malamutes`.) Set only the teams you want.
3. Optional: change the time, e.g. `npx supabase@latest secrets set TEAMS_POST_TIME=08:00`
4. Make sure `supabase-telegram-teams.sql` has been run and `send-reminders` is redeployed.

Treat the Teams URL like a password: anyone with it can post to the channel.

## Teams channel: 3-day, 48-hour and 24-hour alerts

Besides the morning post, the channel gets an alert when an open assignment is
**3 days** (72 hours) from its due time, again at **48 hours**, and again at **24 hours**.
These run every minute, so they don't depend on the 9 AM post. Times are Pacific; an
assignment with no due time counts as due at 11:59 PM. Each assignment is alerted
once per mark; if its due date changes, it alerts again for the new date. One that's
added late gets only the nearest alert (e.g. 20 hours left: just the 24-hour one). Done assignments are skipped.

It uses the same Teams URLs and log table as the morning post, so there's nothing new to
run in SQL. Just redeploy:
```powershell
npx supabase@latest functions deploy send-reminders --no-verify-jwt
```
Optional: change the marks, e.g. `npx supabase@latest secrets set TEAMS_HOURS_BEFORE=72,48,24,2`

Test right now (posts the alerts for everything currently inside 3 days, without
marking them sent):
```powershell
Invoke-RestMethod -Method Post -Uri "https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders" -Headers @{ "x-cron-secret" = "YOUR_CRON_SECRET" } -ContentType "application/json" -Body '{"countdownTest": true}'
```
