import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './MeetingNotes.css';

const PRIORITIES = ['high', 'medium', 'low'];

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

const EMPTY_FORM = {
  title: '',
  date: '',
  attendees: '',
  priority: 'medium',
  notes: '',
  action_items: '',
  tags: '',
};

export default function MeetingNotes({ quarterId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'form' | 'detail'
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [detailNote, setDetailNote] = useState(null);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotes();

  }, [quarterId]);

  async function fetchNotes() {
    setLoading(true);
    let query = supabase
      .from('meeting_notes')
      .select('*')
      .order('date', { ascending: false });
    if (quarterId) query = query.eq('quarter_id', quarterId);
    const { data, error } = await query;
    if (!error) setNotes(data || []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      quarter_id: quarterId || null,
      title: form.title.trim(),
      date: form.date || null,
      attendees: form.attendees.trim(),
      priority: form.priority,
      notes: form.notes.trim(),
      action_items: form.action_items
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean),
      tags: form.tags
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    };

    let result;
    if (editingId) {
      result = await supabase
        .from('meeting_notes')
        .update(payload)
        .eq('id', editingId);
    } else {
      result = await supabase.from('meeting_notes').insert([payload]);
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      await fetchNotes();
      setView('list');
      resetForm();
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this meeting note?')) return;
    await supabase.from('meeting_notes').delete().eq('id', id);
    if (detailNote?.id === id) setView('list');
    await fetchNotes();
  }

  function openNew() {
    resetForm();
    setEditingId(null);
    setError('');
    setView('form');
  }

  function openEdit(note) {
    setForm({
      title: note.title || '',
      date: note.date || '',
      attendees: note.attendees || '',
      priority: note.priority || 'medium',
      notes: note.notes || '',
      action_items: (note.action_items || []).join('\n'),
      tags: (note.tags || []).join(', '),
    });
    setEditingId(note.id);
    setError('');
    setView('form');
  }

  function openDetail(note) {
    setDetailNote(note);
    setView('detail');
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  const allTags = [...new Set(notes.flatMap(n => n.tags || []))];

  const filtered = notes.filter(n => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      n.title?.toLowerCase().includes(q) ||
      n.notes?.toLowerCase().includes(q) ||
      n.attendees?.toLowerCase().includes(q);
    const matchTag = !filterTag || (n.tags || []).includes(filterTag);
    return matchSearch && matchTag;
  });

  if (loading) return <div className="mn-loading">Loading meeting notes…</div>;

  if (view === 'form') {
    return (
      <div className="mn-wrap">
        <div className="mn-form-header">
          <h2 className="mn-title">{editingId ? 'Edit meeting' : 'New meeting'}</h2>
        </div>

        <div className="mn-card mn-form-card">
          {error && <div className="mn-error">{error}</div>}

          <div className="mn-field">
            <label className="mn-label">Meeting title *</label>
            <input
              className="mn-input"
              placeholder="e.g. Q3 Strategy Review"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="mn-row-2">
            <div className="mn-field">
              <label className="mn-label">Date</label>
              <input
                type="date"
                className="mn-input"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="mn-field">
              <label className="mn-label">Priority</label>
              <select
                className="mn-input"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mn-field">
            <label className="mn-label">Attendees</label>
            <input
              className="mn-input"
              placeholder="e.g. Shubham, Alex, Maria"
              value={form.attendees}
              onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))}
            />
          </div>

          <div className="mn-field">
            <label className="mn-label">Notes</label>
            <textarea
              className="mn-input mn-textarea"
              rows={5}
              placeholder="Key discussion points, decisions made…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="mn-field">
            <label className="mn-label">Action items (one per line)</label>
            <textarea
              className="mn-input mn-textarea"
              rows={3}
              placeholder={"Send follow-up email\nSchedule next sync"}
              value={form.action_items}
              onChange={e => setForm(f => ({ ...f, action_items: e.target.value }))}
            />
          </div>

          <div className="mn-field">
            <label className="mn-label">Tags (comma-separated)</label>
            <input
              className="mn-input"
              placeholder="e.g. strategy, q3, marketing"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            />
          </div>

          <div className="mn-form-actions">
            <button
              className="mn-btn mn-btn-ghost"
              onClick={() => { setView('list'); resetForm(); }}
            >
              Cancel
            </button>
            <button
              className="mn-btn mn-btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'detail' && detailNote) {
    const n = notes.find(x => x.id === detailNote.id) || detailNote;
    const actions = (n.action_items || []).filter(Boolean);
    return (
      <div className="mn-wrap">
        <button className="mn-back-btn" onClick={() => setView('list')}>
          ← All notes
        </button>
        <div className="mn-card mn-detail-card">
          <div className="mn-detail-header">
            <div>
              <h2 className="mn-detail-title">{n.title}</h2>
              <div className="mn-meta-row">
                {n.date && <span className="mn-meta">📅 {formatDate(n.date)}</span>}
                {n.attendees && <span className="mn-meta">👥 {n.attendees}</span>}
                {n.priority && (
                  <span className={`mn-badge mn-badge-${n.priority}`}>{n.priority}</span>
                )}
              </div>
              {(n.tags || []).length > 0 && (
                <div className="mn-tags">
                  {n.tags.map(t => <span key={t} className="mn-tag">{t}</span>)}
                </div>
              )}
            </div>
            <div className="mn-detail-actions">
              <button className="mn-btn mn-btn-ghost mn-btn-sm" onClick={() => openEdit(n)}>
                Edit
              </button>
              <button
                className="mn-btn mn-btn-danger mn-btn-sm"
                onClick={() => handleDelete(n.id)}
              >
                Delete
              </button>
            </div>
          </div>

          {n.notes && (
            <div className="mn-detail-section">
              <h4 className="mn-section-label">Notes</h4>
              <p className="mn-detail-body">{n.notes}</p>
            </div>
          )}

          {actions.length > 0 && (
            <div className="mn-detail-section">
              <h4 className="mn-section-label">Action items</h4>
              <ul className="mn-action-list">
                {actions.map((a, i) => (
                  <li key={i} className="mn-action-item">
                    <span className="mn-action-dot" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="mn-wrap">
      <div className="mn-list-header">
        <h2 className="mn-title">Meeting Notes</h2>
        <button className="mn-btn mn-btn-primary" onClick={openNew}>
          + New meeting
        </button>
      </div>

      <div className="mn-search-bar">
        <input
          className="mn-input mn-search-input"
          placeholder="Search notes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {allTags.length > 0 && (
          <select
            className="mn-input mn-filter-select"
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
          >
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="mn-empty">
          <div className="mn-empty-icon">📋</div>
          <p className="mn-empty-text">No meeting notes yet.</p>
          <p className="mn-empty-sub">Click "New meeting" to add your first one.</p>
        </div>
      ) : (
        <div className="mn-list">
          {filtered.map(n => (
            <div
              key={n.id}
              className="mn-card mn-note-card"
              onClick={() => openDetail(n)}
            >
              <div className="mn-note-header">
                <span className="mn-note-title">{n.title}</span>
                <div className="mn-note-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className="mn-icon-btn"
                    title="Edit"
                    onClick={() => openEdit(n)}
                  >✏️</button>
                  <button
                    className="mn-icon-btn mn-icon-btn-danger"
                    title="Delete"
                    onClick={() => handleDelete(n.id)}
                  >🗑️</button>
                </div>
              </div>
              <div className="mn-meta-row">
                {n.date && <span className="mn-meta">📅 {formatDate(n.date)}</span>}
                {n.attendees && <span className="mn-meta">👥 {n.attendees}</span>}
                {n.priority && (
                  <span className={`mn-badge mn-badge-${n.priority}`}>{n.priority}</span>
                )}
              </div>
              {n.notes && <p className="mn-note-preview">{n.notes}</p>}
              {(n.tags || []).length > 0 && (
                <div className="mn-tags">
                  {n.tags.map(t => <span key={t} className="mn-tag">{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}