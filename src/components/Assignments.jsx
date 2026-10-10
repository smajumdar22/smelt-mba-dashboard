import React, { useState, useEffect, useCallback } from 'react';
import { dueColor, dueLabel, AVATAR_COLORS } from '../lib/constants';
import { useTeam } from '../lib/team';
import { supabase } from '../lib/supabase';
import { ReminderModal } from './Reminders';
import { isShared } from '../lib/completions';

function priorityBadge(p) {
  const map = { high: 'badge-red', medium: 'badge-orange', low: 'badge-gray' };
  const label = { high: 'HIGH', medium: 'MED', low: 'LOW' };
  return <span className={`badge ${map[p]||'badge-gray'}`}>{label[p]||'MED'}</span>;
}

const PRIORITY_DOT = { high: 'var(--danger)', medium: 'var(--accent3)', low: 'var(--text3)' };
const DUE_BADGE = { overdue: 'badge-red', today: 'badge-yellow', soon: 'badge-orange', ok: 'badge-gray' };

function avatarColor(name, members) {
  const i = members.indexOf(name);
  return AVATAR_COLORS[i >= 0 ? i % AVATAR_COLORS.length : 0];
}

// ── Per-person completion pills ──────────────────────────
function CompletionPills({ assignment, completions }) {
  const [error, setError] = useState('');
  const { set, count, total } = completions.progress(assignment);
  const allDone = count === total;

  async function toggle(person) {
    setError('');
    try { await completions.togglePerson(assignment, person); }
    catch (e) {
      setError(/assignment_completions/.test(e.message || '')
        ? 'Run supabase-completions.sql in Supabase first.'
        : (e.message || 'Could not save'));
    }
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
        <span style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em'}}>
          Each person marks their part done
        </span>
        <span className="hint">{count} of {total} done</span>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
        {assignment.assigned_to.map(person => {
          const done = set.has(person);
          return (
            <button
              key={person}
              onClick={() => toggle(person)}
              aria-pressed={done}
              style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'6px 14px 6px 8px',
                borderRadius:99,
                border:`1.5px solid ${done ? '#4ef0c060' : 'var(--border)'}`,
                background: done ? '#4ef0c015' : 'var(--surface)',
                color: done ? '#4ef0c0' : 'var(--text2)',
                cursor:'pointer', fontSize:13, fontWeight: done ? 600 : 400,
                transition:'all 0.15s',
              }}
            >
              <span style={{
                width:18, height:18, borderRadius:'50%', flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: done ? '#4ef0c0' : 'var(--border)',
                color: done ? '#000' : 'transparent',
                fontSize:11, fontWeight:700,
              }}>✓</span>
              {person}
            </button>
          );
        })}
      </div>
      {allDone && (
        <div style={{
          marginTop:10, fontSize:12, color:'#4ef0c0',
          background:'#4ef0c010', border:'1px solid #4ef0c030',
          borderRadius:8, padding:'6px 12px', textAlign:'center',
        }}>
          ✅ Everyone's done, so the task is complete
        </div>
      )}
    </div>
  );
}

// ── Assignee avatar stack ────────────────────────────────
function AvatarStack({ names, finished }) {
  const members = useTeam().members;
  if (!names?.length) return null;
  const shown = names.slice(0, 3);
  const extra = names.length - shown.length;
  return (
    <div className="task-avatars">
      {shown.map((name, i) => (
        <div
          key={name}
          className={`task-avatar ${finished?.has(name) ? 'finished' : ''}`}
          style={{
            background: `${avatarColor(name, members)}25`,
            color: avatarColor(name, members),
            zIndex: shown.length - i,
          }}
          title={finished ? `${name}: ${finished.has(name) ? 'done' : 'not done yet'}` : name}
        >
          {name.slice(0, 2).toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <div className="task-avatar task-avatar-extra" title={names.slice(3).join(', ')}>
          +{extra}
        </div>
      )}
    </div>
  );
}

// ── Single task row ───────────────────────────────────────
function TaskRow({ a, onOpen, onToggleDone, completions }) {
  const dc = dueColor(a.due_date);
  const shared = isShared(a);
  const prog = shared ? completions.progress(a) : null;
  return (
    <div className="task-row" onClick={() => onOpen(a.id)}>
      {shared && !a.done ? (
        // Shared task: open it so each person can tick their own part.
        <button
          className={`assign-check shared ${prog.count ? 'partial' : ''}`}
          title={`${prog.count} of ${prog.total} done. Tap to mark your part`}
          aria-label={`${prog.count} of ${prog.total} people done. Open to mark your part`}
          onClick={e => { e.stopPropagation(); onOpen(a.id); }}
        >
          {prog.count}/{prog.total}
        </button>
      ) : (
        <div
          className={`assign-check ${a.done ? 'done' : ''}`}
          onClick={e => { e.stopPropagation(); shared ? onOpen(a.id) : onToggleDone(a.id, a.done); }}
        >
          {a.done && <span style={{fontSize:11,color:'#000'}}>✓</span>}
        </div>
      )}
      <div className="task-content">
        <div className="task-title-row">
          <span className={`task-name ${a.done ? 'done' : ''}`}>{a.name}</span>
          <span className="priority-dot" style={{ background: PRIORITY_DOT[a.priority] || PRIORITY_DOT.medium }} />
        </div>
        <div className="task-meta-row">
          <span
            className={`task-type-dot ${a.type === 'discussion' ? 'type-discussion' : 'type-assignment'}`}
            title={a.type === 'discussion' ? 'Discussion' : 'Assignment'}
          />
          {a.done ? (
            <span className="hint" style={{ color: 'var(--text3)' }}>Completed</span>
          ) : (
            <span className={`badge ${DUE_BADGE[dc]}`}>{dueLabel(a.due_date)}</span>
          )}
          {a.canvas_url && (
            <a
              href={a.canvas_url}
              target="_blank"
              rel="noopener noreferrer"
              className="canvas-link"
              onClick={e => e.stopPropagation()}
            >
              Canvas↗
            </a>
          )}
          <div className="task-meta-spacer" />
          {shared && !a.done && (
            <span className="hint">{prog.count} of {prog.total} done</span>
          )}
          <AvatarStack names={a.assigned_to} finished={shared ? prog.set : null} />
        </div>
      </div>
    </div>
  );
}

// ── Main Assignments component ───────────────────────────
export function Assignments({ assignments, courses, onAdd, onEdit, onToggleDone, completions }) {
  const [tab, setTab] = useState('pending');
  const [detail, setDetail] = useState(null);
  const [reminderFor, setReminderFor] = useState(null);

  let filtered = assignments;
  if (tab === 'pending') filtered = assignments.filter(a => !a.done);
  else if (tab === 'done') filtered = assignments.filter(a => a.done);

  const sorted = [...filtered].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  const byCourse = {};
  sorted.forEach(a => {
    if (!byCourse[a.course_id]) byCourse[a.course_id] = [];
    byCourse[a.course_id].push(a);
  });

  // Totals per course, independent of the active tab filter — always reflects true progress
  const totalsByCourse = {};
  assignments.forEach(a => {
    if (!totalsByCourse[a.course_id]) totalsByCourse[a.course_id] = { done: 0, total: 0 };
    totalsByCourse[a.course_id].total += 1;
    if (a.done) totalsByCourse[a.course_id].done += 1;
  });

  const detailItem = detail ? assignments.find(x => x.id === detail) : null;
  const detailCourse = detailItem ? courses.find(c => c.id === detailItem.course_id) : null;
  const hasMultipleAssignees = (detailItem?.assigned_to?.length || 0) > 1;

  return (
    <div className="content">
      <div className="tabs">
        {['pending','done','all'].map(t => (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      <button className="btn btn-accent full-width" onClick={onAdd}>+ Add Assignment / Discussion</button>

      {courses.map(c => {
        const items = byCourse[c.id] || [];
        if (!items.length) return null;
        const totals = totalsByCourse[c.id] || { done: 0, total: 0 };
        const pct = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;
        return (
          <div key={c.id} className="card">
            <div className="card-header task-group-header">
              <div className="task-group-top">
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div className="course-dot" style={{background:c.color}} />
                  <span className="card-title">{c.code}</span>
                </div>
                <span className="hint">{totals.done} of {totals.total} done</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%`, background: c.color }} />
              </div>
            </div>
            <div className="card-body list-body">
              {items.map(a => (
                <TaskRow key={a.id} a={a} onOpen={setDetail} onToggleDone={onToggleDone} completions={completions} />
              ))}
            </div>
          </div>
        );
      })}

      {Object.keys(byCourse).length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            {tab === 'pending' ? 'Nothing pending!' : 'No items'}
            <div style={{marginTop:10}}>
              <button className="btn btn-ghost btn-sm" onClick={onAdd}>Add one</button>
            </div>
          </div>
        </div>
      )}

      {reminderFor && (() => {
        const a = assignments.find(x => x.id === reminderFor);
        if (!a) return null;
        return (
          <ReminderModal
            assignment={a}
            course={courses.find(c => c.id === a.course_id)}
            onClose={() => setReminderFor(null)}
          />
        );
      })()}

      {/* Detail modal */}
      {detailItem && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">{detailItem.name}</div>

            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
              <span className={`badge ${detailItem.type==='discussion'?'badge-green':'badge-yellow'}`}>
                {detailItem.type==='discussion'?'DISCUSSION':'ASSIGNMENT'}
              </span>
              {priorityBadge(detailItem.priority)}
              <span className={`badge badge-${dueColor(detailItem.due_date)==='overdue'?'red':dueColor(detailItem.due_date)==='today'?'yellow':dueColor(detailItem.due_date)==='soon'?'orange':'gray'}`}>
                {dueLabel(detailItem.due_date)}
              </span>
            </div>

            <div className="detail-rows">
              {detailCourse && (
                <div className="detail-row">
                  <span className="detail-label">Course</span>
                  <span style={{color:detailCourse.color}}>{detailCourse.code} — {detailCourse.name}</span>
                </div>
              )}
              {detailItem.assigned_to?.length > 0 && (
                <div className="detail-row">
                  <span className="detail-label">Assigned</span>
                  <span>{detailItem.assigned_to.join(', ')}</span>
                </div>
              )}
              {detailItem.notes && (
                <div className="detail-row">
                  <span className="detail-label">Notes</span>
                  <span>{detailItem.notes}</span>
                </div>
              )}
              {detailItem.canvas_url && (
                <div className="detail-row">
                  <span className="detail-label">Canvas</span>
                  <a href={detailItem.canvas_url} target="_blank" rel="noopener noreferrer"
                    className="canvas-link">Open assignment↗</a>
                </div>
              )}
            </div>

            {/* Per-person completion — only when multiple assignees */}
            {hasMultipleAssignees && (
              <div style={{
                margin:'14px 0',
                padding:'12px 14px',
                background:'var(--surface)',
                borderRadius:10,
                border:'1px solid var(--border)',
              }}>
                <CompletionPills assignment={detailItem} completions={completions} />
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>Close</button>
              {!detailItem.done && (
                <button className="btn btn-ghost btn-sm"
                  onClick={() => { setReminderFor(detailItem.id); setDetail(null); }}>
                  🔔 Remind me
                </button>
              )}
              {!hasMultipleAssignees ? (
                <button
                  className={`btn ${detailItem.done?'btn-ghost':'btn-accent'} btn-sm`}
                  onClick={() => { onToggleDone(detailItem.id, detailItem.done); setDetail(null); }}
                >
                  {detailItem.done ? 'Mark undone' : 'Mark done ✓'}
                </button>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => completions.setEveryone(detailItem, !detailItem.done).catch(() => {})}
                  title={detailItem.done ? 'Reopen for everyone' : 'Mark done for everyone'}
                >
                  {detailItem.done ? 'Reopen for all' : 'All done'}
                </button>
              )}
              <button className="btn btn-ghost btn-sm"
                onClick={() => { setDetail(null); onEdit(detailItem); }}>
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
