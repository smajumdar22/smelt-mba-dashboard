import React from 'react';
import { dueColor, dueLabel, TEAM, AVATAR_COLORS } from '../lib/constants';

function priorityBadge(p) {
  const map = { high: 'badge-red', medium: 'badge-orange', low: 'badge-gray' };
  return <span className={`badge ${map[p]||'badge-gray'}`}>{p?.toUpperCase().slice(0,3)||'MED'}</span>;
}
function typeBadge(t) {
  return <span className={`badge ${t==='discussion'?'badge-green':'badge-yellow'}`}>{t==='discussion'?'DISC':'ASGN'}</span>;
}

export function Dashboard({ assignments, meetings, courses, onSwitchView, onToggleDone }) {
  const total = assignments.length;
  const done = assignments.filter(a => a.done).length;
  const overdue = assignments.filter(a => !a.done && dueColor(a.due_date) === 'overdue').length;
  const todayCount = assignments.filter(a => !a.done && dueColor(a.due_date) === 'today').length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const upcoming = assignments
    .filter(a => !a.done)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);

  return (
    <div className="content">
      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">PROGRESS</div>
          <div className="stat-value">{pct}%</div>
          <div className="progress-bar"><div className="progress-fill" style={{width:`${pct}%`}} /></div>
          <div className="stat-sub">{done}/{total} done</div>
        </div>
        <div className="stats-col">
          <div className="stat-card mini">
            <div className="stat-label">OVERDUE</div>
            <div className="stat-value" style={{color:overdue?'var(--danger)':'var(--text2)'}}>{overdue}</div>
          </div>
          <div className="stat-card mini">
            <div className="stat-label">DUE TODAY</div>
            <div className="stat-value" style={{color:todayCount?'var(--accent)':'var(--text2)'}}>{todayCount}</div>
          </div>
        </div>
      </div>

      {/* Upcoming */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Upcoming</span>
          <button className="btn btn-ghost btn-sm" onClick={() => onSwitchView('assignments')}>See all →</button>
        </div>
        <div className="card-body list-body">
          {upcoming.length === 0
            ? <div className="empty-state"><div className="empty-icon">🎉</div>All clear!</div>
            : upcoming.map(a => {
                const c = courses.find(x => x.id === a.course_id);
                const dc = dueColor(a.due_date);
                return (
                  <div key={a.id} className="assign-item">
                    <div className={`assign-check ${a.done?'done':''}`} onClick={() => onToggleDone(a.id, a.done)}>
                      {a.done && <span style={{fontSize:11,color:'#000'}}>✓</span>}
                    </div>
                    <div className="assign-meta">
                      <div className={`assign-name ${a.done?'done':''}`}>{a.name}</div>
                      <div className="assign-sub">
                        {typeBadge(a.type)}
                        <span className={`hint due-${dc}`}>{dueLabel(a.due_date)}</span>
                        {c && <span className="hint" style={{color:c.color}}>·&nbsp;{c.code}</span>}
                      </div>
                    </div>
                    {priorityBadge(a.priority)}
                  </div>
                );
              })}
        </div>
      </div>

      {/* Meetings */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Meetings</span>
          <button className="btn btn-ghost btn-sm" onClick={() => onSwitchView('meetings')}>Manage →</button>
        </div>
        <div className="card-body list-body">
          {meetings.length === 0
            ? <div className="empty-state" style={{padding:'16px'}}>No meetings yet</div>
            : meetings.slice(0, 3).map(m => (
                <div key={m.id} className="meeting-item">
                  <div className="meeting-icon-wrap">🎥</div>
                  <div className="meeting-info">
                    <div className="meeting-name">{m.name}</div>
                    <div className="meeting-time">{m.day} · {m.time}{m.recurring ? ' · Weekly' : ''}</div>
                    {m.link && <a href={m.link} className="meeting-link" target="_blank" rel="noopener noreferrer">Join Teams →</a>}
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* Team mini */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Team — Seattle Melt</span>
          <button className="btn btn-ghost btn-sm" onClick={() => onSwitchView('team')}>Detail →</button>
        </div>
        <div className="card-body">
          <div className="member-grid">
            {TEAM.map((name, i) => {
              const open = assignments.filter(a => a.assigned_to?.includes(name) && !a.done).length;
              return (
                <div key={name} className="member-chip">
                  <div className="member-avatar" style={{background:`${AVATAR_COLORS[i]}20`,color:AVATAR_COLORS[i],border:`1px solid ${AVATAR_COLORS[i]}50`}}>
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
    </div>
  );
}
