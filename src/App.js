import React, { useState } from 'react';
import { useAppData } from './hooks/useAppData';
import { Modal } from './components/Modal';
import { Dashboard } from './components/Dashboard';
import { Assignments } from './components/Assignments';
import { Courses, Meetings, Team } from './components/Views';
import MeetingNotes from './components/MeetingNotes';
import ExportButton from './components/ExportButton';

import './App.css';

const VIEWS = [
  { id: 'dashboard', icon: '📊', label: 'Overview' },
  { id: 'assignments', icon: '📝', label: 'Tasks' },
  { id: 'courses', icon: '📚', label: 'Courses' },
  { id: 'meetings', icon: '🎥', label: 'Meetings' },
  { id: 'team', icon: '👥', label: 'Team' },
  { id: 'notes', icon: '📋', label: 'Notes' },
];

export default function App() {
  const data = useAppData();
  const [view, setView] = useState('dashboard');
  const [modal, setModal] = useState(null);

  function openModal(type, editData = null) {
    setModal({ type, data: editData });
  }
  function closeModal() { setModal(null); }

  if (data.loading) return (
    <div className="app-loading">
      <div className="loading-logo">SEATTLE MELT</div>
      <div className="loading-sub">Loading your dashboard…</div>
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  if (data.error) return (
    <div className="app-loading">
      <div className="loading-logo">⚠️</div>
      <div className="loading-sub" style={{color:'var(--danger)'}}>Connection error</div>
      <div style={{fontSize:12,color:'var(--text3)',marginTop:8,maxWidth:280,textAlign:'center'}}>{data.error}</div>
      <div style={{fontSize:12,color:'var(--text3)',marginTop:12}}>Check your .env.local Supabase credentials</div>
    </div>
  );

  const actions = {
    addAssignment: data.addAssignment,
    updateAssignment: data.updateAssignment,
    deleteAssignment: data.deleteAssignment,
    addCourse: data.addCourse,
    updateCourse: data.updateCourse,
    deleteCourse: data.deleteCourse,
    addMeeting: data.addMeeting,
    deleteMeeting: data.deleteMeeting,
    addQuarter: data.addQuarter,
  };

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div>
          <div className="logo">SEATTLE MELT <span>MBA</span></div>
          <div className="quarter-label">{data.activeQuarter?.label || 'No quarter'}</div>
        </div>
        <div className="header-actions">
          <ExportButton
            quarterId={data.activeQid}
            quarterLabel={data.activeQuarter?.label}
            allQuarters={data.quarters}
            courses={data.allCourses}
            assignments={data.assignments}
          />
          <button className="btn-icon" onClick={() => openModal('quarter')} title="Quarters">⚡</button>
          <button className="btn-icon" onClick={() => {
            const type = view === 'courses' ? 'course' : view === 'meetings' ? 'meeting' : 'assignment';
            openModal(type);
          }} title="Add">+</button>
        </div>
      </div>

      {/* Quarter switcher banner */}
      {data.quarters.length > 1 && (
        <div className="quarter-strip">
          {data.quarters.map(q => (
            <button key={q.id}
              className={`quarter-btn ${q.id === data.activeQid ? 'active' : ''}`}
              onClick={() => data.switchQuarter(q.id)}>
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Nav */}
      <nav className="nav">
        {VIEWS.map(v => (
          <button key={v.id} className={`nav-btn ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id)}>
            <span className="nav-icon">{v.icon}</span>{v.label}
          </button>
        ))}
      </nav>

      {/* Views */}
      {view === 'dashboard' && (
        <Dashboard
          assignments={data.assignments}
          meetings={data.meetings}
          courses={data.courses}
          onSwitchView={setView}
          onToggleDone={data.toggleDone}
        />
      )}
      {view === 'assignments' && (
        <Assignments
          assignments={data.assignments}
          courses={data.courses}
          onAdd={() => openModal('assignment')}
          onEdit={(a) => openModal('assignment', a)}
          onToggleDone={data.toggleDone}
        />
      )}
      {view === 'courses' && (
        <Courses
          courses={data.allCourses}
          assignments={data.assignments}
          quarters={data.quarters}
          activeQid={data.activeQid}
          onAdd={() => openModal('course')}
          onEdit={(c) => openModal('course', c)}
        />
      )}
      {view === 'meetings' && (
        <Meetings
          meetings={data.meetings}
          onAdd={() => openModal('meeting')}
          onDelete={data.deleteMeeting}
        />
      )}
      {view === 'team' && (
        <Team assignments={data.assignments} />
      )}
      {view === 'notes' && (
        <MeetingNotes quarterId={data.activeQid} />
      )}

      {/* Modals */}
      {modal && modal.type !== 'quarter' && (
        <Modal
          type={modal.type}
          data={modal.data}
          courses={data.courses}
          onClose={closeModal}
          actions={actions}
        />
      )}

      {/* Quarter modal */}
      {modal?.type === 'quarter' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Quarters</div>
            {data.quarters.map(q => (
              <div key={q.id} className="quarter-row">
                <span style={{fontFamily:'var(--mono)',fontSize:13,color:q.id===data.activeQid?'var(--accent)':'var(--text)'}}>
                  {q.label}{q.id===data.activeQid?' ●':''}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => { data.switchQuarter(q.id); closeModal(); }}>
                  Select
                </button>
              </div>
            ))}
            <div style={{borderTop:'1px solid var(--border)',marginTop:12,paddingTop:12}}>
              <AddQuarterInline onAdd={async (label) => { await data.addQuarter(label); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline add quarter form inside the modal ──
function AddQuarterInline({ onAdd }) {
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!label.trim()) return;
    setSaving(true);
    try { await onAdd(label.trim()); setLabel(''); } catch(e) {}
    setSaving(false);
  }

  return (
    <div style={{display:'flex',gap:8,alignItems:'center'}}>
      <input
        placeholder="e.g. Summer 2026"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        style={{
          flex:1, fontSize:13,
          background:'var(--surface)',
          border:'1px solid var(--border)',
          borderRadius:8, padding:'7px 10px',
          color:'var(--text)',
        }}
      />
      <button
        className="btn btn-accent"
        onClick={handleAdd}
        disabled={saving || !label.trim()}
        style={{fontSize:13,padding:'7px 14px',whiteSpace:'nowrap'}}
      >
        {saving ? '…' : '+ Add'}
      </button>
    </div>
  );
}