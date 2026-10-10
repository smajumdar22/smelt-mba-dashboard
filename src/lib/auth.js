import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Default due-date reminders: one a day at 9 AM, from 7 days before through the due date, by email.
export const DEFAULT_SETTINGS = {
  enabled: true,
  days_before: 7,
  times: ['09:00'],
  by_email: true,
  by_sms: false,
  only_mine: false,
  member_name: null,
  scope: 'all', // 'all' | 'mine' | 'picked'
};

// Turn on the default reminders the first time someone signs in.
// Never overwrites settings they've already changed.
const ensured = new Set();
async function ensureReminderSettings(user) {
  if (!user || ensured.has(user.id)) return;
  ensured.add(user.id);
  await supabase.from('reminder_settings').upsert(
    {
      user_id: user.id,
      ...DEFAULT_SETTINGS,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
    },
    { onConflict: 'user_id', ignoreDuplicates: true }
  );
}

// Signed-in Supabase session, or null. `ready` is false until the first check finishes.
export function useSession() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
      ensureReminderSettings(data.session?.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer: Supabase calls made directly inside this callback can deadlock.
      setTimeout(() => ensureReminderSettings(s?.user), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  return { session, ready };
}

export function sendLoginLink(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}
