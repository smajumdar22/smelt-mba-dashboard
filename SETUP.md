# 🎓 Seattle Melt MBA Tracker — Setup Guide

A real-time shared assignment tracker for the Seattle Melt MBA team.
Built with React + Supabase. Free to host, real-time sync for all 6 members.

---

## ⏱ Setup Time: ~15 minutes

---

## STEP 1 — Create a free Supabase project

1. Go to https://supabase.com and sign up (free)
2. Click **New Project**
3. Name it: `smelt-mba`
4. Choose **US West** region (closest to Seattle)
5. Set a database password and save it
6. Wait ~2 minutes for your project to provision

---

## STEP 2 — Set up the database

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase-setup.sql` from this folder
4. Copy the entire contents and paste into the SQL Editor
5. Click **Run** (green button)
6. You should see "Success. No rows returned" — that's correct!

---

## STEP 3 — Get your API credentials

1. In your Supabase dashboard, go to **Settings → API**
2. Copy your **Project URL** (looks like `https://xxxx.supabase.co`)
3. Copy your **anon public** key (long string starting with `eyJ...`)

---

## STEP 4 — Configure the app

1. In the `smelt-mba` folder, copy `.env.example` to `.env.local`:
   ```
   cp .env.example .env.local
   ```
2. Open `.env.local` and fill in your values:
   ```
   REACT_APP_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGci...your-full-key-here
   ```

---

## STEP 5 — Test locally (optional)

Make sure you have Node.js 18+ installed, then:
```bash
cd smelt-mba
npm install
npm start
```
Opens at http://localhost:3000 — try adding a course and assignment!

---

## STEP 6 — Deploy to Netlify (free hosting)

### Option A: Drag & Drop (easiest, 2 minutes)
1. Run `npm run build` — creates a `build/` folder
2. Go to https://netlify.com → sign up free
3. Drag the `build/` folder onto the Netlify deploy zone
4. Your app is live! Copy the URL (e.g. `https://smelt-mba.netlify.app`)

### Option B: Git + Auto-deploy (recommended for updates)
1. Push this folder to a GitHub repo
2. In Netlify: **Add new site → Import from Git**
3. Connect your GitHub repo
4. Set build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `build`
5. Under **Site settings → Environment variables**, add:
   - `REACT_APP_SUPABASE_URL` → your Supabase URL
   - `REACT_APP_SUPABASE_ANON_KEY` → your anon key
6. Click **Deploy site**

---

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
