// Sends reminders by email (Resend) or text (Twilio). Called every minute by pg_cron.
//
// 1. One-off reminders people set for a course or assignment (table: reminders).
// 2. Automatic due-date reminders (table: reminder_settings): at each of a person's
//    chosen times of day, one message listing their open assignments due within
//    their chosen number of days (default: 9:00 AM, 7 days before through the due date).
//
// Secrets (supabase secrets set ...):
//   CRON_SECRET          shared secret the cron job sends in x-cron-secret
//   RESEND_API_KEY       for email
//   REMINDER_FROM_EMAIL  e.g. "SMELT Reminders <reminders@yourdomain.com>"
//   APP_URL              e.g. https://smeltdashboard.netlify.app (optional, linked in messages)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER   for texts (optional)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

const MAX_ATTEMPTS = 3;
const CATCH_UP_MINUTES = 30; // a missed run still sends if within this window
const DEFAULT_TZ = "America/Los_Angeles";

const env = (k: string) => Deno.env.get(k) ?? "";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );

// ── Senders ──
// One item in an email: title line, a small meta line, the description, and a link.
type Block = { title: string; meta?: string; body?: string; link?: string };

const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : "");

async function sendEmail(to: string, subject: string, blocks: Block[]) {
  const key = env("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY not set");
  const appUrl = env("APP_URL");

  const text = blocks.map((b) => [
    b.title,
    b.meta,
    b.body,
    safeUrl(b.link) && `Canvas: ${safeUrl(b.link)}`,
  ].filter(Boolean).join("\n")).join("\n\n") + (appUrl ? `\n\nOpen the dashboard: ${appUrl}` : "");

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;color:#1d1f24;max-width:560px">` +
    blocks.map((b) => {
      const link = safeUrl(b.link);
      return `<div style="padding:12px 0;border-bottom:1px solid #e6e7eb">` +
        `<div style="font-weight:600;font-size:15px">${escapeHtml(b.title)}</div>` +
        (b.meta ? `<div style="color:#6c7280;font-size:13px;margin-top:2px">${escapeHtml(b.meta)}</div>` : "") +
        (b.body ? `<div style="margin-top:8px;white-space:pre-wrap">${escapeHtml(b.body)}</div>` : "") +
        (link ? `<div style="margin-top:8px"><a href="${escapeHtml(link)}">Open in Canvas</a></div>` : "") +
        `</div>`;
    }).join("") +
    (appUrl ? `<p style="margin-top:16px"><a href="${escapeHtml(appUrl)}">Open the dashboard</a></p>` : "") +
    `</div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env("REMINDER_FROM_EMAIL") || "SMELT Reminders <onboarding@resend.dev>",
      to, subject, text, html,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function sendText(to: string, body: string) {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) throw new Error("Twilio secrets not set");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 600) }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

// Always send to the account's own verified address, never a client-supplied one.
function destination(user: User, channel: string): string {
  if (channel === "sms") {
    if (!user.phone || !user.phone_confirmed_at) throw new Error("No verified phone");
    return user.phone.startsWith("+") ? user.phone : `+${user.phone}`;
  }
  if (!user.email || !user.email_confirmed_at) throw new Error("No verified email");
  return user.email;
}

function userCache(db: SupabaseClient) {
  const cache = new Map<string, User | null>();
  return async (id: string) => {
    if (!cache.has(id)) {
      const { data } = await db.auth.admin.getUserById(id);
      cache.set(id, data?.user ?? null);
    }
    return cache.get(id) ?? null;
  };
}

// ── Time helpers ──
function localNow(tz: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date());
  } catch {
    return localNow(DEFAULT_TZ);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function toMinutes(hhmm: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
}

function daysBetween(fromDate: string, toDate: string) {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86400000);
}

const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").trim().replace(/\s+\n/g, "\n");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

function formatDue(date: string, time?: string | null) {
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
  if (!time) return day;
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  const t = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return `${day}, ${t}`;
}

function dueText(days: number) {
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

// ── 1. One-off reminders ──
async function sendOneOffs(db: SupabaseClient, getUser: (id: string) => Promise<User | null>) {
  const { data: due, error } = await db
    .from("reminders")
    .select("*")
    .eq("sent", false)
    .lt("attempts", MAX_ATTEMPTS)
    .lte("remind_at", new Date().toISOString())
    .order("remind_at")
    .limit(50);
  if (error) throw error;

  let sent = 0, failed = 0, skipped = 0;
  for (const r of due ?? []) {
    // Claim the row first so overlapping runs never send twice.
    const { data: claimed } = await db
      .from("reminders")
      .update({ sent: true, sent_at: new Date().toISOString(), attempts: r.attempts + 1 })
      .eq("id", r.id).eq("sent", false)
      .select("id");
    if (!claimed?.length) continue;

    try {
      let a: { done: boolean; notes: string | null; canvas_url: string | null; due_date: string | null; due_time: string | null } | null = null;
      if (r.assignment_id) {
        ({ data: a } = await db.from("assignments")
          .select("done,notes,canvas_url,due_date,due_time").eq("id", r.assignment_id).maybeSingle());
        if (!a || a.done) {
          await db.from("reminders").update({ last_error: "Skipped: assignment done" }).eq("id", r.id);
          skipped++;
          continue;
        }
        const { data: st } = await db.from("reminder_settings").select("member_name").eq("user_id", r.user_id).maybeSingle();
        const me = (st?.member_name || "").trim();
        if (me) {
          const { data: mine } = await db.from("assignment_completions").select("completed")
            .eq("assignment_id", r.assignment_id).ilike("person", me).eq("completed", true).limit(1);
          if (mine?.length) {
            await db.from("reminders").update({ last_error: "Skipped: you finished your part" }).eq("id", r.id);
            skipped++;
            continue;
          }
        }
      }
      const user = await getUser(r.user_id);
      if (!user) throw new Error("User not found");
      const to = destination(user, r.channel);
      const due = a?.due_date ? `Due ${formatDue(a.due_date, a.due_time)}` : "";
      if (r.channel === "sms") {
        const extra = [r.message, due, clip(a?.notes, 120)].filter(Boolean).join(" · ");
        await sendText(to, `Reminder: ${r.course_name}${extra ? ` - ${extra}` : ""}`);
      } else {
        const body = [r.message && `Your note: ${r.message}`, clip(a?.notes, 1500)].filter(Boolean).join("\n\n");
        await sendEmail(to, `Reminder: ${r.course_name}`, [{
          title: r.course_name,
          meta: due || undefined,
          body: body || undefined,
          link: a?.canvas_url ?? undefined,
        }]);
      }
      sent++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      // Release the claim so the next run retries, up to MAX_ATTEMPTS.
      await db.from("reminders")
        .update({ sent: false, sent_at: null, last_error: msg.slice(0, 500) })
        .eq("id", r.id);
    }
  }
  return { sent, failed, skipped };
}

// ── 2. Automatic due-date reminders ──
async function sendDueDigests(db: SupabaseClient, getUser: (id: string) => Promise<User | null>) {
  const { data: settings, error } = await db.from("reminder_settings").select("*").eq("enabled", true);
  if (error) throw error;
  if (!settings?.length) return { sent: 0, failed: 0 };

  // Open assignments due from yesterday (UTC slack) through the longest window.
  const maxDays = Math.max(...settings.map((s) => s.days_before ?? 7));
  const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const until = new Date(Date.now() + (maxDays + 1) * 86400000).toISOString().slice(0, 10);

  const [{ data: assignments }, { data: courses }] = await Promise.all([
    db.from("assignments").select("id,name,due_date,due_time,done,assigned_to,course_id,notes,canvas_url")
      .eq("done", false).gte("due_date", from).lte("due_date", until),
    db.from("courses").select("id,code,name"),
  ]);
  const courseLabel = new Map((courses ?? []).map((c) => [c.id, c.code || c.name]));

  // Per-assignment choices: true = always include, false = never include.
  const { data: picks } = await db.from("reminder_picks")
    .select("user_id,assignment_id,included")
    .in("user_id", settings.map((s) => s.user_id));
  const pickOf = new Map((picks ?? []).map((p) => [`${p.user_id}:${p.assignment_id}`, p.included as boolean]));

  // Shared tasks: who has already finished their part (by team-member name).
  const ids = (assignments ?? []).map((a) => a.id);
  const { data: comps } = ids.length
    ? await db.from("assignment_completions").select("assignment_id,person").eq("completed", true).in("assignment_id", ids)
    : { data: [] as { assignment_id: string; person: string }[] };
  const finished = new Set((comps ?? []).map((c) => `${c.assignment_id}:${String(c.person).toLowerCase()}`));

  let sent = 0, failed = 0;

  for (const s of settings) {
    const now = localNow(s.timezone || DEFAULT_TZ);
    const member = (s.member_name || "").trim().toLowerCase();

    for (const t of s.times ?? []) {
      const at = toMinutes(t);
      const late = now.minutes - at;
      if (at < 0 || late < 0 || late >= CATCH_UP_MINUTES) continue;

      const items = (assignments ?? [])
        .map((a) => ({ ...a, days: daysBetween(now.date, a.due_date) }))
        .filter((a) => a.days >= 0 && a.days <= s.days_before)
        // due earlier today and already past: don't send "due today"
        .filter((a) => !(a.days === 0 && a.due_time && toMinutes(String(a.due_time).slice(0, 5)) <= now.minutes))
        .filter((a) => !member || !finished.has(`${a.id}:${member}`))
        .filter((a) => {
          const pick = pickOf.get(`${s.user_id}:${a.id}`);
          if (pick !== undefined) return pick;
          const scope = s.scope ?? (s.only_mine ? "mine" : "all");
          if (scope === "picked") return false;
          if (scope === "mine") {
            return !member || (a.assigned_to ?? []).some((n: string) => n.toLowerCase() === member);
          }
          return true;
        })
        .sort((a, b) => a.days - b.days);
      if (!items.length) continue;

      const slot = `${now.date} ${t}`;
      const channels = [s.by_email && "email", s.by_sms && "sms"].filter(Boolean) as string[];

      for (const channel of channels) {
        // Log first; if the row already exists this slot was already sent.
        const { data: logged } = await db.from("reminder_log")
          .upsert({ user_id: s.user_id, slot, channel },
            { onConflict: "user_id,slot,channel", ignoreDuplicates: true })
          .select("slot");
        if (!logged?.length) continue;

        try {
          const user = await getUser(s.user_id);
          if (!user) throw new Error("User not found");
          const to = destination(user, channel);
          const lines = items.map((a) =>
            `${courseLabel.get(a.course_id) ?? "Course"}: ${a.name} (${dueText(a.days)}${a.due_time ? ` ${formatDue(a.due_date, a.due_time).split(", ").pop()}` : ""})`
          );
          const blocks: Block[] = items.map((a) => ({
            title: a.name,
            meta: `${courseLabel.get(a.course_id) ?? "Course"} · ${dueText(a.days)} (${formatDue(a.due_date, a.due_time)})`,
            body: clip(a.notes, 1500) || undefined,
            link: a.canvas_url ?? undefined,
          }));
          const soonest = items[0];
          const subject = items.length === 1
            ? `${soonest.name} is ${dueText(soonest.days)}`
            : `${items.length} assignments due soon, next ${dueText(soonest.days)}`;

          if (channel === "sms") {
            // One item: include a short description. Several: keep it to one line each.
            const body = items.length === 1
              ? [lines[0], clip(items[0].notes, 200)].filter(Boolean).join("\n")
              : lines.slice(0, 5).join("\n") + (lines.length > 5 ? `\n+${lines.length - 5} more` : "");
            await sendText(to, `SMELT: ${subject}\n${body}`);
          } else {
            await sendEmail(to, subject, blocks);
          }
          sent++;
        } catch (e) {
          failed++;
          console.error(`Due reminder failed for ${s.user_id} ${slot} ${channel}:`, e);
          // Remove the log row so the next run retries within the catch-up window.
          await db.from("reminder_log").delete()
            .eq("user_id", s.user_id).eq("slot", slot).eq("channel", channel);
        }
      }
    }
  }
  return { sent, failed };
}

Deno.serve(async (req) => {
  const secret = env("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const getUser = userCache(db);
  const result: Record<string, unknown> = {};

  try { result.oneOff = await sendOneOffs(db, getUser); }
  catch (e) { result.oneOffError = e instanceof Error ? e.message : String(e); }

  try { result.dueDate = await sendDueDigests(db, getUser); }
  catch (e) { result.dueDateError = e instanceof Error ? e.message : String(e); }

  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
