import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// Per-person completion for tasks with more than one assignee.
// Rows live in assignment_completions (assignment_id, person, completed).
// A shared task counts as done only when every assignee has finished it.

export function isShared(a) {
  return (a?.assigned_to?.length || 0) > 1;
}

export function useCompletions(assignments, updateAssignment) {
  // { [assignmentId]: Set of people who finished }
  const [doneBy, setDoneBy] = useState({});

  const ids = assignments.filter(isShared).map(a => a.id).sort().join(',');

  const load = useCallback(async () => {
    if (!ids) { setDoneBy({}); return; }
    const { data } = await supabase
      .from('assignment_completions')
      .select('assignment_id,person,completed')
      .in('assignment_id', ids.split(','));
    const map = {};
    (data || []).forEach(r => {
      if (!r.completed) return;
      (map[r.assignment_id] ||= new Set()).add(r.person);
    });
    setDoneBy(map);
  }, [ids]);

  useEffect(() => {
    load();
    const channel = supabase.channel('completions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_completions' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // Tick or untick one person, then keep the task's overall "done" in sync.
  async function togglePerson(a, person) {
    const before = doneBy[a.id] || new Set();
    const now = !before.has(person);
    const after = new Set(before);
    if (now) after.add(person); else after.delete(person);
    setDoneBy(m => ({ ...m, [a.id]: after }));

    const { error } = await supabase.from('assignment_completions').upsert(
      { assignment_id: a.id, person, completed: now, completed_at: now ? new Date().toISOString() : null },
      { onConflict: 'assignment_id,person' }
    );
    if (error) {
      setDoneBy(m => ({ ...m, [a.id]: before }));
      throw error;
    }

    const allDone = a.assigned_to.every(p => after.has(p));
    if (allDone !== !!a.done) await updateAssignment(a.id, { done: allDone });
  }

  // Mark everyone done (or not done) at once.
  async function setEveryone(a, done) {
    const rows = a.assigned_to.map(person => ({
      assignment_id: a.id, person, completed: done,
      completed_at: done ? new Date().toISOString() : null,
    }));
    const { error } = await supabase.from('assignment_completions')
      .upsert(rows, { onConflict: 'assignment_id,person' });
    if (error) throw error;
    setDoneBy(m => ({ ...m, [a.id]: done ? new Set(a.assigned_to) : new Set() }));
    await updateAssignment(a.id, { done });
  }

  function progress(a) {
    const set = doneBy[a.id] || new Set();
    const finished = a.assigned_to.filter(p => set.has(p));
    return { finished, count: finished.length, total: a.assigned_to.length, set };
  }

  return { doneBy, togglePerson, setEveryone, progress };
}
