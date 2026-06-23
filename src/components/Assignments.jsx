import React, { useState, useEffect, useCallback } from 'react';
import { dueColor, dueLabel } from '../lib/constants';
import { supabase } from '../lib/supabase';

function priorityBadge(p) {
  const map = { high: 'badge-red', medium: 'badge-orange', low: 'badge-gray' };
  const label = { high: 'HIGH', medium: 'MED', low: 'LOW' };
  return <span className={`badge ${map[p]||'badge-gray'}`}>{label[p]||'MED'}</span>;
}
function typeBadge(t) {
  return <span className={`badge ${t==='discussion'?'badge-green':'badge-yellow'}`}>{t==='discussion'?'DISC':'ASGN'}</span>;
}

// ── Per-person completion pills ──────────────────────────
function CompletionPills({ assignmentId, assignees, onAllDone }) {
  const [completions, setCompletions] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!assignees.length) { setLoading(false); return; }
    const { data } = await supabase
      .from('assignment_completions')
      .select('*')
      .eq('assignment_id', assignmentId);
    const map = {};
    (data || []).forEach(r => { map[r.person] = r.completed; });
    setCompletions(map);
    setLoading(false);
  }, [assignmentId, assignees]);

  useEffect(() => { load(); }, [load]);

  async function toggle(person) {
    const newDone = !completions[person];
    await supabase.from('assignment_completions').upsert(
      {
        assignment_id: assignmentId,
        person,
        completed: newDone,
        completed_at: newDone ? new Date().toISOString() : null,
      },
      { onConflict: 'assignment_id,person' }
    );
    const updated = { ...completions, [person]: newDone };
    setCompletions(updated);
    if (assignees.every(p => updated[p])) onAllDone?.();
  }

  if (loading) return <div style={{fontSize:12,color:'var(--text3)'}}>Loading…</div>;

  const allDone = assignees.length > 0 && assignees.every(p => completions[p]);

  return (
    <div>
      <div style={{fontSize:11,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>
        Mark your completion
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
        {assignees.map(person => {
          const done = !!completions[person];
          return (
            <button
              key={person}
              onClick={() => toggle(person)}
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
          ✅ All team members done!
        </div>
      )}
    </div>
  );
}

// ── Main Assignments component ───────────────────────────
export function Assignments({ assignments, courses, onAdd, onEdit, onToggleDone }) {
  const [tab, setTab] = useState('pending');
  const [detail, setDetail] = useState(null);

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
        return (
          <div key={c.id} className="card">
            <div className="card-header">
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div className="course-dot" style={{background:c.color}} />
                <span className="card-title">{c.code}</span>
              </div>
              <span className="hint">{items.length} item{items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="card-body list-body">
              {items.map(a => {
                const dc = dueColor(a.due_date);
                return (
                  <div key={a.id} className="assign-item" onClick={() => setDetail(a.id)}>
                    <div className={`assign-check ${a.done?'done':''}`}
                      onClick={e => { e.stopPropagation(); onToggleDone(a.id, a.done); }}>
                      {a.done && <span style={{fontSize:11,color:'#000'}}>✓</span>}
                    </div>
                    <div className="assign-meta">
                      <div className={`assign-name ${a.done?'done':''}`}>{a.name}</div>
                      <div className="assign-sub">
                        {typeBadge(a.type)}
                        <span className={`hint due-${dc}`}>{dueLabel(a.due_date)}</span>
                        {a.assigned_to?.length > 0 && (
                          <span className="hint">
                            {a.assigned_to.slice(0,2).join(', ')}{a.assigned_to.length > 2 ? ` +${a.assigned_to.length - 2}` : ''}
                          </span>
                        )}
                        {a.canvas_url && (
                          <a href={a.canvas_url} target="_blank" rel="noopener noreferrer"
                            className="canvas-link" onClick={e => e.stopPropagation()}>Canvas↗</a>
                        )}
                      </div>
                    </div>
                    {priorityBadge(a.priority)}
                  </div>
                );
              })}
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
                <CompletionPills
                  assignmentId={detailItem.id}
                  assignees={detailItem.assigned_to}
                  onAllDone={() => onToggleDone(detailItem.id, false)}
                />
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>Close</button>
              {!hasMultipleAssignees && (
                <button
                  className={`btn ${detailItem.done?'btn-ghost':'btn-accent'} btn-sm`}
                  onClick={() => { onToggleDone(detailItem.id, detailItem.done); setDetail(null); }}
                >
                  {detailItem.done ? 'Mark undone' : 'Mark done ✓'}
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
