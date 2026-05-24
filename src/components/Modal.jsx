import React, { useState, useEffect } from 'react';
import { TEAM, COURSE_COLORS, DAYS } from '../lib/constants';

export function Modal({ type, data, onClose, actions, courses }) {
  const [form, setForm] = useState({});
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedColor, setSelectedColor] = useState(COURSE_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (data) {
      setForm(data);
      setSelectedMembers(data.assigned_to || []);
      setSelectedColor(data.color || COURSE_COLORS[0]);
    }
  }, [data]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleMember = (name) => setSelectedMembers(m =>
    m.includes(name) ? m.filter(x => x !== name) : [...m, name]
  );

  async function submit() {
    setSaving(true); setError('');
    try {
      if (type === 'assignment') {
        if (!form.name?.trim()) { setError('Name required'); setSaving(false); return; }
        const payload = {
          name: form.name.trim(),
          type: form.type || 'assignment',
          course_id: form.course_id || courses[0]?.id,
          due_date: form.due_date || null,
          priority: form.priority || 'medium',
          assigned_to: selectedMembers,
          canvas_url: form.canvas_url || '',
          notes: form.notes || '',
          done: form.done || false,
        };
        if (data?.id) await actions.updateAssignment(data.id, payload);
        else await actions.addAssignment(payload);
      } else if (type === 'course') {
        if (!form.name?.trim()) { setError('Name required'); setSaving(false); return; }
        const payload = {
          name: form.name.trim(),
          code: form.code?.trim() || '',
          color: selectedColor,
          canvas_url: form.canvas_url || '',
        };
        if (data?.id) await actions.updateCourse(data.id, payload);
        else await actions.addCourse(payload);
      } else if (type === 'meeting') {
        if (!form.name?.trim()) { setError('Name required'); setSaving(false); return; }
        await actions.addMeeting({
          name: form.name.trim(),
          day: form.day || 'Sunday',
          time: form.time || '',
          link: form.link || '',
          recurring: form.recurring !== false,
        });
      } else if (type === 'quarter') {
        if (!form.label?.trim()) { setError('Quarter name required'); setSaving(false); return; }
        await actions.addQuarter(form.label.trim());
      }
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this item?')) return;
    setSaving(true);
    try {
      if (type === 'assignment') await actions.deleteAssignment(data.id);
      else if (type === 'course') await actions.deleteCourse(data.id);
      onClose();
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  const title = {
    assignment: data?.id ? 'Edit Task' : 'Add Assignment / Discussion',
    course: data?.id ? 'Edit Course' : 'Add Course',
    meeting: 'Add Meeting Link',
    quarter: 'Add Quarter',
  }[type];

  return (
    <div className="modal-overlay" onClick={e => e.target.classList.contains('modal-overlay') && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-title">{title}</div>
        {error && <div className="form-error">{error}</div>}

        {(type === 'assignment') && <>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="Assignment name" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-input" value={form.type||'assignment'} onChange={e=>set('type',e.target.value)}>
                <option value="assignment">Assignment</option>
                <option value="discussion">Discussion</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-input" value={form.priority||'medium'} onChange={e=>set('priority',e.target.value)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Course</label>
            <select className="form-input" value={form.course_id||''} onChange={e=>set('course_id',e.target.value)}>
              {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={form.due_date||''} onChange={e=>set('due_date',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Assigned to</label>
            <div className="member-toggles">
              {TEAM.map(name => (
                <button key={name} className={`member-toggle ${selectedMembers.includes(name)?'active':''}`}
                  onClick={() => toggleMember(name)}>{name}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Canvas URL (optional)</label>
            <input className="form-input" value={form.canvas_url||''} onChange={e=>set('canvas_url',e.target.value)} placeholder="https://canvas.uw.edu/..." />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={3} value={form.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Any notes..." />
          </div>
        </>}

        {type === 'course' && <>
          <div className="form-group">
            <label className="form-label">Course Name</label>
            <input className="form-input" value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="e.g. Operations Management" />
          </div>
          <div className="form-group">
            <label className="form-label">Course Code</label>
            <input className="form-input" value={form.code||''} onChange={e=>set('code',e.target.value)} placeholder="e.g. OPS 501" />
          </div>
          <div className="form-group">
            <label className="form-label">Color</label>
            <div className="color-picker">
              {COURSE_COLORS.map(col => (
                <div key={col} className={`color-dot ${selectedColor===col?'selected':''}`}
                  style={{background:col}} onClick={() => setSelectedColor(col)} />
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Canvas URL (optional)</label>
            <input className="form-input" value={form.canvas_url||''} onChange={e=>set('canvas_url',e.target.value)} placeholder="https://canvas.uw.edu/courses/..." />
          </div>
        </>}

        {type === 'meeting' && <>
          <div className="form-group">
            <label className="form-label">Meeting Name</label>
            <input className="form-input" value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="e.g. Weekly Team Sync" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Day</label>
              <select className="form-input" value={form.day||'Sunday'} onChange={e=>set('day',e.target.value)}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Time</label>
              <input className="form-input" value={form.time||''} onChange={e=>set('time',e.target.value)} placeholder="7:00 PM" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Teams Meeting Link</label>
            <input className="form-input" value={form.link||''} onChange={e=>set('link',e.target.value)} placeholder="https://teams.microsoft.com/l/..." />
          </div>
          <div className="form-group">
            <label className="form-label">Recurring?</label>
            <select className="form-input" value={form.recurring===false?'0':'1'} onChange={e=>set('recurring',e.target.value==='1')}>
              <option value="1">Yes — weekly</option>
              <option value="0">No — one-time</option>
            </select>
          </div>
        </>}

        {type === 'quarter' && <>
          <div className="form-group">
            <label className="form-label">Quarter Name</label>
            <input className="form-input" value={form.label||''} onChange={e=>set('label',e.target.value)} placeholder="e.g. Fall 2025" />
          </div>
        </>}

        <div className="modal-actions">
          {data?.id && <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={saving}>Delete</button>}
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-accent btn-sm" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : (data?.id ? 'Save' : 'Add')}
          </button>
        </div>
      </div>
    </div>
  );
}
