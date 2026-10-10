import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSession, sendLoginLink, signOut, DEFAULT_SETTINGS } from '../lib/auth';
import { TEAMS } from '../lib/constants';

// Is this assignment in someone's daily reminders?
// A per-assignment pick (true/false) wins; otherwise their scope decides.
export function isIncluded(settings, pick, assignment) {
  if (pick === true || pick === false) return pick;
  const scope = settings?.scope || (settings?.only_mine ? 'mine' : 'all');
  if (scope === 'picked') return false;
  if (scope === 'mine') {
    const me = (settings?.member_name || '').trim().toLowerCase();
    return !me || (assignment.assigned_to || []).some(n => n.toLowerCase() === me);
  }
  return true;
}

async function savePick(userId, assignmentId, included) {
  return supabase.from('reminder_picks').upsert(
    { user_id: userId, assignment_id: assignmentId, included, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,assignment_id' }
  );
}

const PICKS_HINT = 'Run supabase-reminder-picks.sql in Supabase to choose assignments.';

// Reminders go only to the signed-in user's own verified email or phone.
// The server looks up the address at send time, so nobody can send
// reminders to someone else's inbox or phone.

function toLocalInput(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultTime(dueDate) {
  // Day before the due date at 9 AM if that's still ahead, otherwise tomorrow 9 AM.
  if (dueDate) {
    const d = new Date(`${dueDate}T09:00:00`);
    d.setDate(d.getDate() - 1);
    if (d > new Date()) return toLocalInput(d);
  }
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalInput(d);
}

const SETUP_HINT = 'Reminders aren\'t set up yet. Run the reminder SQL files in Supabase first (see SETUP.md).';

// ── Step 1: sign in with a magic link ──
function SignIn() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSending(true); setError('');
    const { error } = await sendLoginLink(email.trim());
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="reminder-note">
        Check <strong>{email}</strong> for a sign-in link. Open it on this device, then come back
        and set your reminder.
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <p className="hint" style={{ marginBottom: 12 }}>
        Sign in to get reminders. We'll email you a one-time link, no password needed.
        Reminders are only sent to you.
      </p>
      {error && <div className="form-error">{error}</div>}
      <div className="inline-form">
        <input className="form-input" type="email" required autoComplete="email"
          placeholder="you@uw.edu" value={email} onChange={e => setEmail(e.target.value)} />
        <button className="btn btn-accent" type="submit" disabled={sending || !email.trim()}>
          {sending ? 'Sending…' : 'Send link'}
        </button>
      </div>
    </form>
  );
}

// ── Verify a phone number before text reminders are allowed ──
function PhoneVerify({ onVerified }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState('enter'); // enter | code
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function normalized() {
    const digits = phone.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) return digits;
    if (digits.length === 10) return `+1${digits}`;
    return `+${digits}`;
  }

  async function sendCode() {
    setBusy(true); setError('');
    const { error } = await supabase.auth.updateUser({ phone: normalized() });
    setBusy(false);
    if (error) setError(error.message);
    else setStage('code');
  }

  async function verify() {
    setBusy(true); setError('');
    const { error } = await supabase.auth.verifyOtp({
      phone: normalized(), token: code.trim(), type: 'phone_change',
    });
    setBusy(false);
    if (error) setError(error.message);
    else onVerified();
  }

  return (
    <div className="reminder-note">
      <div style={{ marginBottom: 8 }}>Verify your phone number to get text reminders.</div>
      {error && <div className="form-error">{error}</div>}
      {stage === 'enter' ? (
        <div className="inline-form">
          <input className="form-input" type="tel" autoComplete="tel" placeholder="(206) 555-0123"
            value={phone} onChange={e => setPhone(e.target.value)} />
          <button className="btn btn-accent btn-sm" onClick={sendCode} disabled={busy || phone.replace(/\D/g, '').length < 10}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </div>
      ) : (
        <div className="inline-form">
          <input className="form-input" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code"
            value={code} onChange={e => setCode(e.target.value)} />
          <button className="btn btn-accent btn-sm" onClick={verify} disabled={busy || code.trim().length < 6}>
            {busy ? 'Checking…' : 'Verify'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 2: create and list one-off reminders for a course or an assignment ──
function ReminderForm({ course, assignment, session }) {
  const [user, setUser] = useState(session.user);
  const [channel, setChannel] = useState('email');
  const [when, setWhen] = useState(() => defaultTime(assignment?.due_date));
  const [message, setMessage] = useState('');
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    let q = supabase.from('reminders').select('*').eq('sent', false).order('remind_at');
    q = assignment ? q.eq('assignment_id', assignment.id) : q.eq('course_id', course.id).is('assignment_id', null);
    const { data, error } = await q;
    if (error) {
      setError(/reminders|assignment_id/.test(error.message) ? SETUP_HINT : error.message);
      return;
    }
    setItems(data || []);
  }, [course?.id, assignment?.id]);

  useEffect(() => { load(); }, [load]);

  async function refreshUser() {
    const { data } = await supabase.auth.getUser();
    if (data?.user) setUser(data.user);
  }

  const phoneReady = !!user.phone && !!user.phone_confirmed_at;

  async function save(e) {
    e.preventDefault();
    setError('');
    const at = new Date(when);
    if (Number.isNaN(at.getTime())) return setError('Pick a date and time');
    if (at <= new Date()) return setError('Pick a time in the future');
    setSaving(true);
    const courseLabel = course ? (course.code || course.name) : '';
    const { error } = await supabase.from('reminders').insert({
      course_id: course?.id ?? assignment?.course_id ?? null,
      assignment_id: assignment?.id ?? null,
      course_name: assignment
        ? [courseLabel, assignment.name].filter(Boolean).join(' · ')
        : (course.code ? `${course.code} · ${course.name}` : course.name),
      channel,
      remind_at: at.toISOString(),
      message: message.trim(),
    });
    setSaving(false);
    if (error) return setError(error.message);
    setMessage('');
    setWhen(defaultTime(assignment?.due_date));
    load();
  }

  async function remove(id) {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) setError(error.message);
    else setItems(xs => xs.filter(x => x.id !== id));
  }

  return (
    <>
      <div className="reminder-account">
        <span className="hint">Signed in as {user.email}</span>
        <button className="link-btn" onClick={() => signOut()}>Sign out</button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form onSubmit={save}>
        <div className="form-group">
          <label className="form-label">Send as</label>
          <div className="segmented" role="radiogroup" aria-label="Reminder type">
            {[['email', 'Email'], ['sms', 'Text']].map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={channel === id}
                className={`segment ${channel === id ? 'active' : ''}`}
                onClick={() => setChannel(id)}>{label}</button>
            ))}
          </div>
          <span className="hint">
            {channel === 'email' ? `To ${user.email}` : phoneReady ? `To ${user.phone}` : ''}
          </span>
        </div>

        {channel === 'sms' && !phoneReady
          ? <PhoneVerify onVerified={refreshUser} />
          : <>
              <div className="form-group">
                <label className="form-label">When</label>
                <input className="form-input" type="datetime-local" required
                  value={when} onChange={e => setWhen(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input className="form-input" maxLength={300} placeholder="e.g. Submit case write-up"
                  value={message} onChange={e => setMessage(e.target.value)} />
              </div>
              <button className="btn btn-accent full-width" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Set reminder'}
              </button>
            </>}
      </form>

      <div className="reminder-list">
        <div className="form-label" style={{ margin: '18px 0 8px' }}>Your upcoming reminders</div>
        {items.length === 0 && <div className="hint">None yet for this {assignment ? 'assignment' : 'course'}.</div>}
        {items.map(r => (
          <div key={r.id} className="reminder-row">
            <div>
              <div className="reminder-when">
                {new Date(r.remind_at).toLocaleString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
                <span className="badge badge-gray" style={{ marginLeft: 8 }}>{r.channel === 'sms' ? 'Text' : 'Email'}</span>
                {r.attempts >= 3 && <span className="badge badge-red" style={{ marginLeft: 6 }} title={r.last_error || ''}>Couldn't send</span>}
              </div>
              {r.message && <div className="hint">{r.message}</div>}
            </div>
            <button className="btn-icon" aria-label="Delete reminder" onClick={() => remove(r.id)}>🗑</button>
          </div>
        ))}
      </div>
    </>
  );
}

export function ReminderModal({ course, assignment, onClose }) {
  const { session, ready } = useSession();
  const label = assignment ? assignment.name : (course.code || course.name);

  return (
    <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && onClose()}>
      <div className="modal" role="dialog" aria-label={`Reminders for ${label}`}>
        <div className="modal-handle" />
        <div className="modal-title">Remind me · {label}</div>
        {!ready && <div className="hint">Loading…</div>}
        {ready && !session && <SignIn />}
        {ready && session && assignment && <DailyToggle assignment={assignment} session={session} />}
        {ready && session && <ReminderForm course={course} assignment={assignment} session={session} />}
        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DUE-DATE REMINDER SETTINGS
// ─────────────────────────────────────────────
const ALL_MEMBERS = [...new Set(TEAMS.flatMap(t => t.members))].sort();
const DAY_OPTIONS = [0, 1, 2, 3, 5, 7, 10, 14, 21, 30];

function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ── Checklist of upcoming assignments; each change saves right away ──
function AssignmentPicker({ userId, settings }) {
  const [items, setItems] = useState(null);
  const [courses, setCourses] = useState({});
  const [picks, setPicks] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const today = new Date();
      const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const [a, c, p] = await Promise.all([
        supabase.from('assignments').select('id,name,due_date,course_id,assigned_to,done')
          .eq('done', false).gte('due_date', iso(today)).order('due_date').limit(60),
        supabase.from('courses').select('id,code,name'),
        supabase.from('reminder_picks').select('assignment_id,included').eq('user_id', userId),
      ]);
      if (p.error) setError(/reminder_picks/.test(p.error.message) ? PICKS_HINT : p.error.message);
      setItems(a.data || []);
      setCourses(Object.fromEntries((c.data || []).map(x => [x.id, x.code || x.name])));
      setPicks(Object.fromEntries((p.data || []).map(x => [x.assignment_id, x.included])));
    })();
  }, [userId]);

  async function toggle(a, next) {
    setPicks(x => ({ ...x, [a.id]: next }));
    const { error } = await savePick(userId, a.id, next);
    if (error) {
      setError(/reminder_picks/.test(error.message) ? PICKS_HINT : error.message);
      setPicks(x => { const y = { ...x }; delete y[a.id]; return y; });
    }
  }

  if (!items) return <div className="hint" style={{ marginTop: 10 }}>Loading assignments…</div>;

  return (
    <div className="picker">
      <div className="picker-head">
        <span className="form-label">Upcoming assignments</span>
        <span className="hint">Ticks save right away</span>
      </div>
      {error && <div className="form-error">{error}</div>}
      {items.length === 0 && <div className="hint">No upcoming open assignments.</div>}
      {items.map(a => {
        const on = isIncluded(settings, picks[a.id], a);
        const due = new Date(`${a.due_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return (
          <label key={a.id} className="picker-row">
            <input type="checkbox" checked={on} onChange={() => toggle(a, !on)} />
            <span className="picker-name">{a.name}</span>
            <span className="hint">{courses[a.course_id] ? `${courses[a.course_id]} · ` : ''}{due}</span>
          </label>
        );
      })}
    </div>
  );
}

// ── On/off switch for one assignment's daily reminders ──
function DailyToggle({ assignment, session }) {
  const [settings, setSettings] = useState(null);
  const [pick, setPick] = useState(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [st, pk] = await Promise.all([
        supabase.from('reminder_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('reminder_picks').select('included')
          .eq('user_id', session.user.id).eq('assignment_id', assignment.id).maybeSingle(),
      ]);
      if (pk.error) setError(/reminder_picks/.test(pk.error.message) ? PICKS_HINT : pk.error.message);
      setSettings(st.data || DEFAULT_SETTINGS);
      setPick(pk.data ? pk.data.included : null);
    })();
  }, [session.user.id, assignment.id]);

  if (!settings || pick === undefined) return null;
  const on = isIncluded(settings, pick, assignment);
  const enabled = settings.enabled !== false;

  async function flip() {
    setPick(!on);
    const { error } = await savePick(session.user.id, assignment.id, !on);
    if (error) { setPick(pick); setError(/reminder_picks/.test(error.message) ? PICKS_HINT : error.message); }
  }

  return (
    <div className="reminder-note">
      {error && <div className="form-error">{error}</div>}
      <label className="toggle-row" style={{ padding: 0 }}>
        <input type="checkbox" checked={on} onChange={flip} />
        <span>Include in my daily due-date reminders</span>
      </label>
      <div className="hint" style={{ marginTop: 6 }}>
        {!enabled
          ? 'Your daily reminders are turned off in Reminder settings.'
          : on
            ? `You'll get it ${settings.days_before === 0 ? 'on the due date' : `daily from ${settings.days_before} days before`}, with its description and Canvas link.`
            : 'No daily reminders for this one. You can still add one-time reminders below.'}
      </div>
    </div>
  );
}

function SettingsForm({ session }) {
  const [user, setUser] = useState(session.user);
  const [s, setS] = useState(null);
  const [newTime, setNewTime] = useState('18:00');
  const [timeTouched, setTimeTouched] = useState(false); // picked a time but didn't click + Add time
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('reminder_settings').select('*').eq('user_id', session.user.id).maybeSingle();
      if (error) return setError(/reminder_settings/.test(error.message) ? SETUP_HINT : error.message);
      const row = data || { ...DEFAULT_SETTINGS };
      setS({ ...row, scope: row.scope || (row.only_mine ? 'mine' : 'all') });
    })();
  }, [session.user.id]);

  const set = (k, v) => { setSaved(false); setS(x => ({ ...x, [k]: v })); };
  const phoneReady = !!user.phone && !!user.phone_confirmed_at;

  async function refreshUser() {
    const { data } = await supabase.auth.getUser();
    if (data?.user) setUser(data.user);
  }

  function addTime() {
    setTimeTouched(false);
    if (!newTime || s.times.includes(newTime)) return;
    set('times', [...s.times, newTime].sort());
  }

  async function save() {
    setError('');
    if (s.enabled && !s.by_email && !s.by_sms) return setError('Pick email, text, or both');
    if (s.enabled && s.by_sms && !phoneReady) return setError('Verify your phone number to get texts');
    if (s.scope === 'mine' && !s.member_name) return setError('Pick which team member you are');
    // Include a time that was picked but not added with "+ Add time".
    let times = s.times;
    if (s.enabled && timeTouched && newTime && !times.includes(newTime) && times.length < 12) {
      times = [...times, newTime].sort();
      setS(x => ({ ...x, times }));
      setTimeTouched(false);
    }
    setSaving(true);
    const { error } = await supabase.from('reminder_settings').upsert({
      user_id: session.user.id,
      enabled: s.enabled,
      days_before: s.days_before,
      times,
      by_email: s.by_email,
      by_sms: s.by_sms,
      scope: s.scope || 'all',
      only_mine: s.scope === 'mine',
      member_name: s.member_name || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) setError(`Couldn't save: ${error.message}`);
    else setSaved(true);
  }

  if (!s) return error ? <div className="form-error">{error}</div> : <div className="hint">Loading…</div>;

  const perDay = s.times.length;
  const summary = !s.enabled
    ? 'Due-date reminders are off.'
    : `${perDay} reminder${perDay > 1 ? 's' : ''} a day (${s.times.map(formatTime).join(', ')}), `
      + (s.days_before === 0 ? 'on the due date' : `from ${s.days_before} day${s.days_before > 1 ? 's' : ''} before through the due date`)
      + `, by ${[s.by_email && 'email', s.by_sms && 'text'].filter(Boolean).join(' and ') || '—'}.`;

  return (
    <>
      <div className="reminder-account">
        <span className="hint">Signed in as {user.email}</span>
        <button className="link-btn" onClick={() => signOut()}>Sign out</button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <label className="toggle-row">
        <input type="checkbox" checked={s.enabled} onChange={e => set('enabled', e.target.checked)} />
        <span>Remind me before assignments are due</span>
      </label>

      <div className="reminder-note">{summary} Finished assignments stop reminding.</div>

      {s.enabled && <>
        <div className="form-group">
          <label className="form-label">Start reminding</label>
          <select className="form-input" value={s.days_before} onChange={e => set('days_before', Number(e.target.value))}>
            {DAY_OPTIONS.map(d => (
              <option key={d} value={d}>{d === 0 ? 'Only on the due date' : `${d} day${d > 1 ? 's' : ''} before`}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Times each day</label>
          <div className="time-chips">
            {s.times.map(t => (
              <span key={t} className="time-chip">
                {formatTime(t)}
                {s.times.length > 1 && (
                  <button aria-label={`Remove ${formatTime(t)}`} onClick={() => set('times', s.times.filter(x => x !== t))}>×</button>
                )}
              </span>
            ))}
          </div>
          {s.times.length < 12 && (
            <div className="inline-form" style={{ marginTop: 8 }}>
              <input className="form-input" type="time" value={newTime} onChange={e => { setNewTime(e.target.value); setTimeTouched(true); setSaved(false); }} />
              <button className="btn btn-ghost btn-sm" onClick={addTime} disabled={s.times.includes(newTime)}>+ Add time</button>
            </div>
          )}
          <span className="hint">Add more times to get more reminders per day.</span>
        </div>

        <div className="form-group">
          <label className="form-label">Send as</label>
          <label className="toggle-row">
            <input type="checkbox" checked={s.by_email} onChange={e => set('by_email', e.target.checked)} />
            <span>Email to {user.email}</span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={s.by_sms} onChange={e => set('by_sms', e.target.checked)} />
            <span>Text{phoneReady ? ` to ${user.phone}` : ''}</span>
          </label>
          {s.by_sms && !phoneReady && <PhoneVerify onVerified={refreshUser} />}
        </div>

        <div className="form-group">
          <label className="form-label">Which assignments</label>
          <select className="form-input" value={s.scope} onChange={e => set('scope', e.target.value)}>
            <option value="all">All assignments</option>
            <option value="mine">Only ones assigned to me</option>
            <option value="picked">Only the ones I pick</option>
          </select>
          <label className="form-label" style={{ marginTop: 10 }}>Your name on the team</label>
          <select className="form-input" value={s.member_name || ''}
            onChange={e => set('member_name', e.target.value)}>
            <option value="">I am…</option>
            {ALL_MEMBERS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="hint">
            Used for "assigned to me", and to stop reminders once you've marked your part of a shared task done.
          </span>
          <AssignmentPicker userId={session.user.id} settings={s} />
        </div>
      </>}

      <button className="btn btn-accent full-width" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save settings'}
      </button>
    </>
  );
}

export function ReminderSettingsModal({ onClose }) {
  const { session, ready } = useSession();
  return (
    <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && onClose()}>
      <div className="modal" role="dialog" aria-label="Reminder settings">
        <div className="modal-handle" />
        <div className="modal-title">Reminder settings</div>
        {!ready && <div className="hint">Loading…</div>}
        {ready && !session && <SignIn />}
        {ready && session && <SettingsForm session={session} />}
        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
