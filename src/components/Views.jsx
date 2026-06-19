import React, { useState } from 'react';
import { TEAM, AVATAR_COLORS } from '../lib/constants';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────
// STATUS helpers
// ─────────────────────────────────────────────
const STATUS_COLORS = {
  not_started: 'var(--text3)',
  in_progress: '#f5a623',
  complete:    '#4ef0c0',
};
const STATUS_LABELS = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete:    'Complete',
};

// ─────────────────────────────────────────────
// MODULE TASK ROW
// ─────────────────────────────────────────────
function ModuleTaskRow({ task, onToggle, onDelete }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 0', borderBottom: '1px solid var(--border)',
    }}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => onToggle(task.id, task.done)}
        style={{ accentColor: '#4ef0c0', width: 14, height: 14, flexShrink: 0, cursor: 'pointer' }}
      />
      <span style={{
        flex: 1, fontSize: 12,
        color: task.done ? 'var(--text3)' : 'var(--text)',
        textDecoration: task.done ? 'line-through' : 'none',
      }}>{task.name}</span>
      {task.due_date && (
        <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
          {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
      <button
        onClick={() => onDelete(task.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, opacity: 0.4, padding: 0 }}
      >🗑</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// ADD TASK FORM
// ─────────────────────────────────────────────
function AddTaskForm({ moduleId, courseId, quarterId, onAdded, onCancel }) {
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from('module_tasks').insert([{
      module_id: moduleId,
      course_id: courseId,
      quarter_id: quarterId,
      name: name.trim(),
      due_date: dueDate || null,
      done: false,
    }]);
    setSaving(false);
    onAdded();
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}
      onClick={e => e.stopPropagation()}>
      <input
        autoFocus
        placeholder="Task name"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onCancel(); }}
        style={{
          flex: 1, fontSize: 12, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 6,
          padding: '5px 8px', color: 'var(--text)',
        }}
      />
      <input
        type="date"
        value={dueDate}
        onChange={e => setDueDate(e.target.value)}
        style={{
          fontSize: 11, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 6,
          padding: '5px 6px', color: 'var(--text3)', width: 130,
        }}
      />
      <button className="btn btn-accent"
        style={{ fontSize: 12, padding: '5px 10px' }}
        onClick={handleAdd} disabled={saving}>
        {saving ? '…' : 'Add'}
      </button>
      <button className="btn" style={{ fontSize: 12, padding: '5px 8px' }} onClick={onCancel}>✕</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE PANEL (expanded)
// ─────────────────────────────────────────────
function ModulePanel({ module, courseId, quarterId, courseColor, onUpdate, onDelete }) {
  const [tasks, setTasks] = useState([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: module.name,
    week_number: module.week_number || '',
    start_date: module.start_date || '',
    description: module.description || '',
    status: module.status || 'not_started',
  });
  const [saving, setSaving] = useState(false);

  async function loadTasks() {
    const { data } = await supabase
      .from('module_tasks')
      .select('*')
      .eq('module_id', module.id)
      .order('created_at');
    setTasks(data || []);
    setTasksLoaded(true);
  }

  // Load tasks on mount
  React.useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('module_tasks')
        .select('*')
        .eq('module_id', module.id)
        .order('created_at');
      setTasks(data || []);
      setTasksLoaded(true);
    }
    load();
  }, [module.id]);

  async function handleSaveModule() {
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      week_number: form.week_number ? parseInt(form.week_number, 10) : null,
      start_date: form.start_date || null,
      description: form.description.trim(),
      status: form.status,
    };
    await supabase.from('modules').update(payload).eq('id', module.id);
    onUpdate({ ...module, ...payload });
    setEditing(false);
    setSaving(false);
  }

  async function handleToggleTask(taskId, done) {
    await supabase.from('module_tasks').update({ done: !done }).eq('id', taskId);
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, done: !done } : t));
  }

  async function handleDeleteTask(taskId) {
    await supabase.from('module_tasks').delete().eq('id', taskId);
    setTasks(ts => ts.filter(t => t.id !== taskId));
  }

  const doneTasks = tasks.filter(t => t.done).length;

  return (
    <div style={{
      border: `1px solid ${courseColor}30`,
      borderRadius: 8,
      marginBottom: 8,
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      {/* Module header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: `${courseColor}10`,
        borderBottom: `1px solid ${courseColor}20`,
      }}>
        {module.week_number && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: courseColor,
            background: `${courseColor}20`, borderRadius: 99,
            padding: '1px 7px', whiteSpace: 'nowrap',
          }}>W{module.week_number}</span>
        )}
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {module.name}
        </span>
        {module.start_date && (
          <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
            📅 {new Date(module.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        <select
          value={form.status}
          onChange={e => {
            const status = e.target.value;
            setForm(f => ({ ...f, status }));
            supabase.from('modules').update({ status }).eq('id', module.id);
            onUpdate({ ...module, status });
          }}
          onClick={e => e.stopPropagation()}
          style={{
            fontSize: 11, background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 6,
            color: STATUS_COLORS[form.status], padding: '3px 6px', cursor: 'pointer',
          }}
        >
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="complete">Complete</option>
        </select>
        <button
          onClick={() => setEditing(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.5, padding: '0 2px' }}
          title="Edit module"
        >✏️</button>
        <button
          onClick={() => onDelete(module.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: 0.4, padding: '0 2px' }}
          title="Delete module"
        >🗑</button>
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>MODULE NAME</div>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={{
                  width: '100%', fontSize: 13, background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  padding: '6px 8px', color: 'var(--text)', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>WEEK #</div>
              <input
                type="number" min="1"
                value={form.week_number}
                onChange={e => setForm(f => ({ ...f, week_number: e.target.value }))}
                style={{
                  width: '100%', fontSize: 13, background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  padding: '6px 8px', color: 'var(--text)', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>START DATE</div>
            <input
              type="date"
              value={form.start_date}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              style={{
                width: '100%', fontSize: 13, background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 6,
                padding: '6px 8px', color: 'var(--text)', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>DESCRIPTION</div>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Key topics, readings, learning objectives…"
              style={{
                width: '100%', fontSize: 12, background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 6,
                padding: '6px 8px', color: 'var(--text)',
                resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" style={{ fontSize: 12 }} onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-accent" style={{ fontSize: 12 }} onClick={handleSaveModule} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Description (read-only) */}
      {!editing && module.description && (
        <div style={{ padding: '7px 12px', fontSize: 12, color: 'var(--text2)', borderBottom: '1px solid var(--border)', lineHeight: 1.5 }}>
          {module.description}
        </div>
      )}

      {/* Tasks */}
      <div style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Tasks · {doneTasks}/{tasks.length} done
          </span>
          <button
            onClick={() => setShowAddTask(v => !v)}
            style={{ background: 'none', border: 'none', fontSize: 12, color: courseColor, cursor: 'pointer', padding: 0 }}
          >
            {showAddTask ? '✕ Cancel' : '+ Add task'}
          </button>
        </div>

        {tasks.length === 0 && !showAddTask && (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '2px 0 4px' }}>No tasks yet.</div>
        )}

        {tasks.map(t => (
          <ModuleTaskRow key={t.id} task={t} onToggle={handleToggleTask} onDelete={handleDeleteTask} />
        ))}

        {showAddTask && (
          <AddTaskForm
            moduleId={module.id}
            courseId={courseId}
            quarterId={quarterId}
            onAdded={() => { setShowAddTask(false); loadTasks(); }}
            onCancel={() => setShowAddTask(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ADD MODULE FORM (inline)
// ─────────────────────────────────────────────
function AddModuleForm({ courseId, quarterId, onAdded, onCancel }) {
  const [name, setName] = useState('');
  const [week, setWeek] = useState('');
  const [startDate, setStartDate] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from('modules').insert([{
      course_id: courseId,
      quarter_id: quarterId,
      name: name.trim(),
      week_number: week ? parseInt(week, 10) : null,
      start_date: startDate || null,
      description: description.trim(),
      status: 'not_started',
    }]);
    setSaving(false);
    onAdded();
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}
      onClick={e => e.stopPropagation()}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 8 }}>
        <input
          autoFocus
          placeholder="Module name *"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
          style={{
            fontSize: 13, background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 6,
            padding: '6px 8px', color: 'var(--text)',
          }}
        />
        <input
          type="number" min="1" placeholder="Wk #"
          value={week}
          onChange={e => setWeek(e.target.value)}
          style={{
            fontSize: 13, background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 6,
            padding: '6px 8px', color: 'var(--text)',
          }}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          style={{
            width: '100%', fontSize: 12, background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 6,
            padding: '6px 8px', color: 'var(--text3)', boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          style={{
            width: '100%', fontSize: 12, background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 6,
            padding: '6px 8px', color: 'var(--text)',
            resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn" style={{ fontSize: 12 }} onClick={onCancel}>Cancel</button>
        <button className="btn btn-accent" style={{ fontSize: 12 }} onClick={handleAdd} disabled={saving || !name.trim()}>
          {saving ? 'Adding…' : 'Add module'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COURSE CARD
// ─────────────────────────────────────────────
function CourseCard({ course, assignments, quarterId, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const [modules, setModules] = useState([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [showAddModule, setShowAddModule] = useState(false);

  const items = assignments.filter(a => a.course_id === course.id);
  const done = items.filter(a => a.done).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;
  const completeMods = modules.filter(m => m.status === 'complete').length;

  async function loadModules() {
    setLoadingMods(true);
    const { data } = await supabase
      .from('modules').select('*')
      .eq('course_id', course.id)
      .order('week_number', { ascending: true, nullsFirst: false });
    setModules(data || []);
    setLoadingMods(false);
  }

  function handleExpand(e) {
    e.stopPropagation();
    if (!expanded) loadModules();
    setExpanded(v => !v);
  }

  return (
    <div className="course-card" style={{ flexDirection: 'column', alignItems: 'stretch', padding: 0, overflow: 'hidden' }}>
      {/* Course row */}
      <div style={{ display: 'flex', alignItems: 'stretch', cursor: 'pointer' }} onClick={() => onEdit(course)}>
        <div className="course-stripe" style={{ background: course.color, flexShrink: 0 }} />
        <div className="course-info" style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div className="course-name">{course.name}</div>
              <div className="course-meta">{course.code}</div>
            </div>
            <button
              onClick={handleExpand}
              style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 6, fontSize: 11, color: 'var(--text2)',
                padding: '3px 8px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {expanded ? '▲ Modules' : '▼ Modules'}
              {!expanded && modules.length > 0 && (
                <span style={{ marginLeft: 4, color: course.color }}>({completeMods}/{modules.length})</span>
              )}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <span className="hint">{items.length} tasks · {done} done</span>
            {course.canvas_url && (
              <a href={course.canvas_url} target="_blank" rel="noopener noreferrer"
                className="canvas-link" onClick={e => e.stopPropagation()}>Canvas↗</a>
            )}
          </div>
          <div className="progress-bar" style={{ marginTop: 8 }}>
            <div className="progress-fill" style={{ width: `${pct}%`, background: course.color }} />
          </div>
        </div>
      </div>

      {/* Modules panel */}
      {expanded && (
        <div style={{ borderTop: `2px solid ${course.color}30`, background: 'var(--surface)', padding: '10px 12px 12px' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Modules · {completeMods}/{modules.length} complete
            </span>
            <button
              style={{ background: 'none', border: 'none', fontSize: 12, color: course.color, cursor: 'pointer', padding: 0 }}
              onClick={() => setShowAddModule(v => !v)}
            >
              {showAddModule ? '✕ Cancel' : '+ Add module'}
            </button>
          </div>

          {showAddModule && (
            <AddModuleForm
              courseId={course.id}
              quarterId={quarterId}
              onAdded={() => { setShowAddModule(false); loadModules(); }}
              onCancel={() => setShowAddModule(false)}
            />
          )}

          {loadingMods && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Loading…</div>}

          {!loadingMods && modules.length === 0 && !showAddModule && (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '4px 0' }}>
              No modules yet — click "+ Add module" to get started.
            </div>
          )}

          {modules.map(m => (
            <ModulePanel
              key={m.id}
              module={m}
              courseId={course.id}
              quarterId={quarterId}
              courseColor={course.color}
              onUpdate={updated => setModules(ms => ms.map(x => x.id === updated.id ? updated : x))}
              onDelete={async id => {
                if (!window.confirm('Delete this module and all its tasks?')) return;
                await supabase.from('modules').delete().eq('id', id);
                setModules(ms => ms.filter(x => x.id !== id));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// COURSES VIEW — grouped by quarter
// ─────────────────────────────────────────────
export function Courses({ courses, assignments, quarters, activeQid, onAdd, onEdit }) {
  const coursesByQuarter = {};
  courses.forEach(c => {
    const qid = c.quarter_id || '__none__';
    if (!coursesByQuarter[qid]) coursesByQuarter[qid] = [];
    coursesByQuarter[qid].push(c);
  });

  const sortedQuarters = [...(quarters || [])].sort((a, b) => {
    if (a.id === activeQid) return -1;
    if (b.id === activeQid) return 1;
    return a.label.localeCompare(b.label);
  });

  return (
    <div className="content">
      <button className="btn btn-accent full-width" onClick={onAdd}>+ Add Course</button>

      {courses.length === 0 && (
        <div className="card">
          <div className="empty-state"><div className="empty-icon">📚</div>No courses yet</div>
        </div>
      )}

      {sortedQuarters.map(q => {
        const qCourses = coursesByQuarter[q.id] || [];
        if (qCourses.length === 0) return null;
        return (
          <div key={q.id} style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)',
            }}>
              <span style={{
                fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                color: q.id === activeQid ? 'var(--accent)' : 'var(--text2)',
              }}>{q.label}</span>
              {q.id === activeQid && (
                <span style={{
                  fontSize: 10, background: 'var(--accent)', color: '#000',
                  borderRadius: 99, padding: '1px 7px', fontWeight: 700, letterSpacing: '0.05em',
                }}>ACTIVE</span>
              )}
              <span className="hint" style={{ marginLeft: 'auto' }}>
                {qCourses.length} course{qCourses.length !== 1 ? 's' : ''}
              </span>
            </div>
            {qCourses.map(c => (
              <CourseCard
                key={c.id} course={c}
                assignments={assignments}
                quarterId={q.id}
                onEdit={onEdit}
              />
            ))}
          </div>
        );
      })}

      {(coursesByQuarter['__none__'] || []).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 12, color: 'var(--text3)', letterSpacing: '0.04em',
            textTransform: 'uppercase', marginBottom: 8,
            paddingBottom: 6, borderBottom: '1px solid var(--border)',
          }}>Unassigned</div>
          {coursesByQuarter['__none__'].map(c => (
            <CourseCard key={c.id} course={c} assignments={assignments} quarterId={null} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MEETINGS — unchanged
// ─────────────────────────────────────────────
export function Meetings({ meetings, onAdd, onDelete }) {
  return (
    <div className="content">
      <button className="btn btn-accent full-width" onClick={onAdd}>+ Add Meeting Link</button>
      {meetings.length > 0 ? (
        <div className="card">
          <div className="card-body list-body">
            {meetings.map(m => (
              <div key={m.id} className="meeting-item">
                <div className="meeting-icon-wrap">🎥</div>
                <div className="meeting-info">
                  <div className="meeting-name">{m.name}</div>
                  <div className="meeting-time">{m.day} · {m.time}{m.recurring ? ' · Weekly' : ''}</div>
                  {m.link
                    ? <a href={m.link} className="meeting-link" target="_blank" rel="noopener noreferrer">Join Teams Meeting →</a>
                    : <span className="hint">No link added</span>}
                </div>
                <button className="btn-icon" onClick={() => {
                  if (window.confirm('Remove this meeting?')) onDelete(m.id);
                }}>🗑</button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state"><div className="empty-icon">🎥</div>No meetings added yet</div>
        </div>
      )}
      <div className="card" style={{ borderColor: '#2b1fa050' }}>
        <div className="card-body">
          <div className="hint" style={{ marginBottom: 6 }}>TEAMS MEETINGS</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Paste your Teams meeting URL when adding a meeting — everyone can join with one tap.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TEAM — unchanged
// ─────────────────────────────────────────────
export function Team({ assignments }) {
  return (
    <div className="content">
      <div className="card">
        <div className="card-header"><span className="card-title">Seattle Melt</span></div>
        <div className="card-body">
          <div className="member-grid">
            {TEAM.map((name, i) => {
              const open = assignments.filter(a => a.assigned_to?.includes(name) && !a.done).length;
              return (
                <div key={name} className="member-chip">
                  <div className="member-avatar"
                    style={{ background: `${AVATAR_COLORS[i]}20`, color: AVATAR_COLORS[i], border: `1px solid ${AVATAR_COLORS[i]}50` }}>
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="member-chip-name">{name}</div>
                  <div className="member-chip-sub">{open} open</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Workload</span></div>
        <div className="card-body">
          {TEAM.map((name, i) => {
            const myAssigns = assignments.filter(a => a.assigned_to?.includes(name));
            const open = myAssigns.filter(a => !a.done).length;
            const total = myAssigns.length;
            const pct = total ? Math.round((total - open) / total * 100) : 0;
            return (
              <div key={name} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13 }}>{name}</span>
                  <span className="hint">{open} pending · {pct}% done</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: AVATAR_COLORS[i] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Assignment breakdown</span></div>
        <div className="card-body">
          {TEAM.map((name, i) => {
            const myOpen = assignments.filter(a => a.assigned_to?.includes(name) && !a.done);
            if (!myOpen.length) return (
              <div key={name} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>{name}</span>
                <span className="badge badge-green">All done!</span>
              </div>
            );
            return (
              <div key={name} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: AVATAR_COLORS[i] }}>{name}</div>
                {myOpen.slice(0, 3).map(a => (
                  <div key={a.id} style={{ fontSize: 12, color: 'var(--text2)', paddingLeft: 8, lineHeight: '1.6' }}>· {a.name}</div>
                ))}
                {myOpen.length > 3 && <div style={{ fontSize: 12, color: 'var(--text3)', paddingLeft: 8 }}>+ {myOpen.length - 3} more</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}