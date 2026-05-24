import React from 'react';
import { TEAM, AVATAR_COLORS } from '../lib/constants';

export function Courses({ courses, assignments, onAdd, onEdit }) {
  return (
    <div className="content">
      <button className="btn btn-accent full-width" onClick={onAdd}>+ Add Course</button>
      {courses.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            No courses yet
          </div>
        </div>
      )}
      {courses.map(c => {
        const items = assignments.filter(a => a.course_id === c.id);
        const done = items.filter(a => a.done).length;
        const pct = items.length ? Math.round(done / items.length * 100) : 0;
        return (
          <div key={c.id} className="course-card" onClick={() => onEdit(c)}>
            <div className="course-stripe" style={{background:c.color}} />
            <div className="course-info">
              <div className="course-name">{c.name}</div>
              <div className="course-meta">{c.code}</div>
              <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
                <span className="hint">{items.length} tasks · {done} done</span>
                {c.canvas_url && (
                  <a href={c.canvas_url} target="_blank" rel="noopener noreferrer"
                    className="canvas-link" onClick={e => e.stopPropagation()}>Canvas↗</a>
                )}
              </div>
              <div className="progress-bar" style={{marginTop:8}}>
                <div className="progress-fill" style={{width:`${pct}%`,background:c.color}} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
          <div className="empty-state">
            <div className="empty-icon">🎥</div>
            No meetings added yet
          </div>
        </div>
      )}
      <div className="card" style={{borderColor:'#2b1fa050'}}>
        <div className="card-body">
          <div className="hint" style={{marginBottom:6}}>TEAMS MEETINGS</div>
          <div style={{fontSize:12,color:'var(--text3)'}}>
            Paste your Teams meeting URL when adding a meeting — everyone can join with one tap.
          </div>
        </div>
      </div>
    </div>
  );
}

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
                    style={{background:`${AVATAR_COLORS[i]}20`,color:AVATAR_COLORS[i],border:`1px solid ${AVATAR_COLORS[i]}50`}}>
                    {name.slice(0,2).toUpperCase()}
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
              <div key={name} style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                  <span style={{fontSize:13}}>{name}</span>
                  <span className="hint">{open} pending · {pct}% done</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width:`${pct}%`,background:AVATAR_COLORS[i]}} />
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
              <div key={name} style={{padding:'8px 0',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:13}}>{name}</span>
                <span className="badge badge-green">All done!</span>
              </div>
            );
            return (
              <div key={name} style={{padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontSize:13,fontWeight:500,marginBottom:4,color:AVATAR_COLORS[i]}}>{name}</div>
                {myOpen.slice(0,3).map(a => (
                  <div key={a.id} style={{fontSize:12,color:'var(--text2)',paddingLeft:8,lineHeight:'1.6'}}>· {a.name}</div>
                ))}
                {myOpen.length > 3 && <div style={{fontSize:12,color:'var(--text3)',paddingLeft:8}}>+ {myOpen.length - 3} more</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
