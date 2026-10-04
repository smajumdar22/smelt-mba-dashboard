import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { quarterTeam, DEFAULT_TEAM_ID } from '../lib/constants';

export function useAppData(teamId) {
  const [quarters, setQuarters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [activeQid, setActiveQid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [q, c, a, m] = await Promise.all([
        supabase.from('quarters').select('*').order('created_at'),
        supabase.from('courses').select('*').order('created_at'),
        supabase.from('assignments').select('*').order('due_date'),
        supabase.from('meetings').select('*').order('created_at'),
      ]);
      if (q.error) throw q.error;
      setQuarters(q.data || []);
      setCourses(c.data || []);
      setAssignments(a.data || []);
      setMeetings(m.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    // Realtime subscriptions
    const channel = supabase.channel('smelt-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quarters' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, fetchAll)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchAll]);

  // ── Quarters (scoped to the active team) ──
  const teamQuarters = quarters.filter(q => quarterTeam(q) === teamId);

  // Keep the selected quarter inside the active team
  useEffect(() => {
    if (loading) return;
    if (teamQuarters.some(q => q.id === activeQid)) return;
    const next = teamQuarters.find(q => q.active) || teamQuarters[teamQuarters.length - 1];
    setActiveQid(next ? next.id : null);
  }, [teamId, loading, quarters]);

  async function addQuarter(label) {
    const { data, error } = await supabase
      .from('quarters')
      .insert({ label, active: false, team: teamId })
      .select()
      .single();
    if (error) {
      if (/team/i.test(error.message)) {
        throw new Error('Run supabase-teams-migration.sql in Supabase first (adds the team column).');
      }
      throw error;
    }
    await fetchAll();
    if (data?.id) setActiveQid(data.id);
  }

  function switchQuarter(id) { setActiveQid(id); }

  // ── Courses ──
  async function addCourse(data) {
    const { error } = await supabase.from('courses').insert({ ...data, quarter_id: activeQid });
    if (error) throw error;
  }

  async function updateCourse(id, data) {
    const { error } = await supabase.from('courses').update(data).eq('id', id);
    if (error) throw error;
  }

  async function deleteCourse(id) {
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) throw error;
  }

  // ── Assignments ──
  async function addAssignment(data) {
    const { error } = await supabase.from('assignments').insert({ ...data, quarter_id: activeQid });
    if (error) throw error;
  }

  async function updateAssignment(id, data) {
    const { error } = await supabase.from('assignments').update(data).eq('id', id);
    if (error) throw error;
  }

  async function deleteAssignment(id) {
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) throw error;
  }

  async function toggleDone(id, current) {
    await updateAssignment(id, { done: !current });
  }

  // ── Meetings ──
  async function addMeeting(data) {
    const { error } = await supabase.from('meetings').insert({ ...data, quarter_id: activeQid });
    if (error) throw error;
  }

  async function deleteMeeting(id) {
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (error) throw error;
  }

  // ── Filtered by quarter ──
  const qCourses = courses.filter(c => c.quarter_id === activeQid);
  const qAssignments = assignments.filter(a => a.quarter_id === activeQid);
  const qMeetings = meetings.filter(m => m.quarter_id === activeQid);
  const activeQuarter = quarters.find(q => q.id === activeQid);

  const teamQuarterIds = new Set(teamQuarters.map(q => q.id));
  const teamCourses = courses.filter(c =>
    c.quarter_id ? teamQuarterIds.has(c.quarter_id) : teamId === DEFAULT_TEAM_ID
  );

  return {
    loading, error,
    quarters: teamQuarters, activeQid, activeQuarter, switchQuarter, addQuarter,
    courses: qCourses, allCourses: teamCourses, addCourse, updateCourse, deleteCourse,
    assignments: qAssignments, addAssignment, updateAssignment, deleteAssignment, toggleDone,
    meetings: qMeetings, addMeeting, deleteMeeting,
  };
}
