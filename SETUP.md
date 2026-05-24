# 🎓 Seattle Melt MBA Tracker — Setup Guide

A real-time shared assignment tracker for the Seattle Melt MBA team.
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

**Deployed but not working** — Check Netlify environment variables are set
(Settings → Environment variables — they don't auto-import from .env.local)

---

Made for Seattle Melt MBA Team 🏔️
