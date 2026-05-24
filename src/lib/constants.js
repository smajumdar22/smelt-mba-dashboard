export const TEAM = ['Ranjith', 'Jane', 'Shubham', 'Yu', 'Galen', 'Chris'];

export const AVATAR_COLORS = [
  '#4ef0c0', '#e8f548', '#f07840', '#a0b4f0', '#f0a0e0', '#80d0a0'
];

export const COURSE_COLORS = [
  '#4ef0c0', '#e8f548', '#f07840', '#a080f0',
  '#f06080', '#60c0f0', '#e0a040', '#80f0a0'
];

export const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function dueColor(d) {
  if (!d) return 'ok';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(d + 'T00:00:00');
  const diff = Math.floor((due - today) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 3) return 'soon';
  return 'ok';
}

export function dueLabel(d) {
  if (!d) return 'No date';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(d + 'T00:00:00');
  const diff = Math.floor((due - today) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}
