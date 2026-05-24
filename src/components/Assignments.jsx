import React, { useState } from 'react';
import { dueColor, dueLabel } from '../lib/constants';

function priorityBadge(p) {
  const map = { high: 'badge-red', medium: 'badge-orange', low: 'badge-gray' };
  const label = { high: 'HIGH', medium: 'MED', low: 'LOW' };
  return <span className={`badge ${map[p]||'badge-gray'}`}>{label[p]||'MED'}</span>;
}
function typeBadge(t) {
  return <span className={`badge ${t==='discussion'?'badge-green':'badge-yellow'}`}>{t==='discussion'?'DISC':'ASGN'}</span>;
}

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

  // Group by course
  const byCourse = {};
  sorted.forEach(a => {
    if (!byCourse[a.course_id]) byCourse[a.course_id] = [];
    byCourse[a.course_id].push(a);
  });

  const detailItem = detail ? assignments.find(x => x.id === detail) : null;
  const detailCourse = detailItem ? courses.find(c => c.id === detailItem.course_id) : null;

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
                  <a href={detailItem.canvas_url} target="_blank" rel="noopener noreferrer" className="canvas-link">Open assignment↗</a>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>Close</button>
              <button className={`btn ${detailItem.done?'btn-ghost':'btn-accent'} btn-sm`}
                onClick={() => { onToggleDone(detailItem.id, detailItem.done); setDetail(null); }}>
                {detailItem.done ? 'Mark undone' : 'Mark done ✓'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setDetail(null); onEdit(detailItem); }}>Edit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
