// ── Teams ──
// Each quarter belongs to one team (quarters.team in Supabase).
// Quarters created before teams existed have no team and count as the default team.
export const TEAMS = [
  {
    id: 'seattle-melt',
    name: 'Seattle Melt',
    members: ['Ranjith', 'Jane', 'Shubham', 'Yu', 'Galen', 'Chris'],
  },
  {
    id: 'malamutes',
    name: 'Sixth Sense', // formerly Malamutes; id kept so existing data stays linked
    members: ['Anne', 'Bill', 'Cintha', 'Ezhilan', 'Fedor', 'Shubham'],
  },
];

export const DEFAULT_TEAM_ID = TEAMS[0].id;

export function quarterTeam(q) {
  return q?.team || DEFAULT_TEAM_ID;
}

// Kept for any code that still imports it; prefer useTeam().members.
export const TEAM = TEAMS[0].members;

export const AVATAR_COLORS = [
  '#8fd6c0', '#e9d68a', '#f0a37a', '#a9b8f5', '#e3a6d6', '#9fd09a'
];

export const COURSE_COLORS = [
  '#4ef0c0', '#e8f548', '#f07840', '#a080f0',
  '#f06080', '#60c0f0', '#e0a040', '#80f0a0'
];

export const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Due dates are a date plus an optional time ("HH:MM" or "HH:MM:SS").
// With no time, the task is treated as due at the end of that day.
export const DEFAULT_DUE_TIME = '23:59';

export function dueAt(date, time) {
  if (!date) return null;
  return new Date(`${date}T${(time || DEFAULT_DUE_TIME).slice(0, 5)}:00`);
}

export function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function dueColor(d, t) {
  if (!d) return 'ok';
  const now = new Date();
  if (t && dueAt(d, t) < now) return 'overdue';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(d + 'T00:00:00');
  const diff = Math.floor((due - today) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 3) return 'soon';
  return 'ok';
}

export function dueLabel(d, t) {
  if (!d) return 'No date';
  const at = t ? ` ${formatTime(t)}` : '';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(d + 'T00:00:00');
  const diff = Math.floor((due - today) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return t && dueAt(d, t) < new Date() ? `Overdue (was${at})` : `Due today${at}`;
  if (diff === 1) return `Due tomorrow${at}`;
  return `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${at}`;
}

// Sort helper: earliest due first, undated last.
export function byDue(a, b) {
  const x = dueAt(a.due_date, a.due_time), y = dueAt(b.due_date, b.due_time);
  if (!x && !y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return x - y;
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}
