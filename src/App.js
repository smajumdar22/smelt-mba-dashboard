import React, { useState } from 'react';
import { useAppData } from './hooks/useAppData';
import { Modal } from './components/Modal';
import { Dashboard } from './components/Dashboard';
import { Assignments } from './components/Assignments';
import { Courses, Meetings, Team } from './components/Views';
import MeetingNotes from './components/MeetingNotes';
import ExportButton from './components/ExportButton';
import { ReminderSettingsModal } from './components/Reminders';
import { TEAMS, DEFAULT_TEAM_ID } from './lib/constants';
import { TeamContext } from './lib/team';
import { useCompletions } from './lib/completions';

import './App.css';

const ICONS = {
  dashboard: <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />,
  assignments: <path d="M9 6h11M9 12h11M9 18h11M4.5 6l1 1 2-2M4.5 12l1 1 2-2M4.5 18l1 1 2-2" />,
  courses: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13V4Z" />,
  meetings: <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h9A1.5 1.5 0 0 1 15 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16.5v-9ZM15 10l6-3v10l-6-3" />,
  team: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6 6 0 0 1 3 5.5" />,
  notes: <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5M9 13h7M9 17h5" />,
};

function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const VIEWS = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'assignments', label: 'Tasks' },
  { id: 'courses', label: 'Courses' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'team', label: 'Team' },
  { id: 'notes', label: 'Notes' },
];

const TEAM_KEY = 'tmmba.activeTeam';

function loadTeamId() {
  try {
    const saved = window.localStorage.getItem(TEAM_KEY);
    if (TEAMS.some(t => t.id === saved)) return saved;
  } catch (e) {}
  return DEFAULT_TEAM_ID;
}

export default function App() {
  const [teamId, setTeamId] = useState(loadTeamId);
  const team = TEAMS.find(t => t.id === teamId) || TEAMS[0];
  const data = useAppData(team.id);
  const [view, setView] = useState('dashboard');
  const [modal, setModal] = useState(null);
  const completions = useCompletions(data.assignments, data.updateAssignment);

  function switchTeam(id) {
    setTeamId(id);
    try { window.localStorage.setItem(TEAM_KEY, id); } catch (e) {}
  }

  function openModal(type, editData = null) {
    setModal({ type, data: editData });
  }
  function closeModal() { setModal(null); }

  if (data.loading) return (
    <div className="app-loading">
      <div className="loading-logo">TMMBA Tracker</div>
      <div className="loading-sub">Loading your dashboard…</div>
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  );

  if (data.error) return (
    <div className="app-loading">
      <div className="loading-logo">Connection error</div>
      <div className="loading-sub" style={{maxWidth:280,textAlign:'center'}}>{data.error}</div>
      <div className="loading-sub">Check your .env.local Supabase credentials</div>
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

  const hasQuarter = !!data.activeQid;

  return (
    <TeamContext.Provider value={team}>
    <div className="app">
      <div className="topbar">
      {/* Header */}
      <header className="header">
        <div className="header-top">
          <div className="brand">
            <div className="brand-kicker">TMMBA Tracker</div>
            <h1 className="brand-team">{team.name}</h1>
          </div>
          <div className="header-actions">
            <button className="btn-bell" onClick={() => openModal('reminders')}
              title="Reminder settings" aria-label="Reminder settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </button>
            {hasQuarter && (
              <button className="btn-add" onClick={() => {
                const type = view === 'courses' ? 'course' : view === 'meetings' ? 'meeting' : 'assignment';
                openModal(type);
              }} title="Add" aria-label="Add">+</button>
            )}
          </div>
        </div>

        <div className="header-controls">
          <div className="segmented" role="tablist" aria-label="Team">
            {TEAMS.map(t => (
              <button key={t.id} role="tab" aria-selected={t.id === team.id}
                className={`segment ${t.id === team.id ? 'active' : ''}`}
                onClick={() => switchTeam(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
          <button className="quarter-chip" onClick={() => openModal('quarter')} title="Change quarter">
            {data.activeQuarter?.label || 'Add quarter'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </div>
      </header>

      {/* Nav */}
      {hasQuarter && <nav className="nav">
        {VIEWS.map(v => (
          <button key={v.id} className={`nav-btn ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id)}>
            <Icon name={v.id} />
            <span>{v.label}</span>
          </button>
        ))}
      </nav>}
      </div>

      {!hasQuarter && (
        <div className="content">
          <div className="card">
            <div className="card-body welcome">
              <div className="welcome-title">Set up {team.name}</div>
              <p className="welcome-text">
                Add your first quarter for this team. Courses, tasks and meetings you add
                afterwards stay with {team.name}.
              </p>
              <AddQuarterInline onAdd={async (label) => { await data.addQuarter(label); }} />
              <div className="welcome-members">
                {team.members.join(' · ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Views */}
      {hasQuarter && view === 'dashboard' && (
        <Dashboard
          assignments={data.assignments}
          meetings={data.meetings}
          courses={data.courses}
          onSwitchView={setView}
          onToggleDone={data.toggleDone}
          completions={completions}
        />
      )}
      {hasQuarter && view === 'assignments' && (
        <Assignments
          assignments={data.assignments}
          courses={data.courses}
          onAdd={() => openModal('assignment')}
          onEdit={(a) => openModal('assignment', a)}
          onToggleDone={data.toggleDone}
          completions={completions}
        />
      )}
      {hasQuarter && view === 'courses' && (
        <Courses
          courses={data.allCourses}
          assignments={data.assignments}
          quarters={data.quarters}
          activeQid={data.activeQid}
          onAdd={() => openModal('course')}
          onEdit={(c) => openModal('course', c)}
        />
      )}
      {hasQuarter && view === 'meetings' && (
        <Meetings
          meetings={data.meetings}
          onAdd={() => openModal('meeting')}
          onDelete={data.deleteMeeting}
        />
      )}
      {hasQuarter && view === 'team' && (
        <Team assignments={data.assignments} />
      )}
      {hasQuarter && view === 'notes' && (
        <MeetingNotes quarterId={data.activeQid} />
      )}

      {/* Modals */}
      {modal?.type === 'reminders' && <ReminderSettingsModal onClose={closeModal} />}
      {modal && modal.type !== 'quarter' && modal.type !== 'reminders' && (
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
            <div className="modal-title">{team.name} · Quarters</div>
            {data.quarters.length === 0 && (
              <div className="hint" style={{padding:'4px 0 10px'}}>No quarters yet for this team.</div>
            )}
            {data.quarters.map(q => (
              <div key={q.id} className="quarter-row">
                <span className={`quarter-name ${q.id === data.activeQid ? 'active' : ''}`}>
                  {q.label}
                </span>
                {q.id === data.activeQid
                  ? <span className="badge badge-green">Current</span>
                  : <button className="btn btn-ghost btn-sm" onClick={() => { data.switchQuarter(q.id); closeModal(); }}>
                      Select
                    </button>}
              </div>
            ))}
            <div style={{borderTop:'1px solid var(--border)',marginTop:12,paddingTop:12}}>
              <AddQuarterInline onAdd={async (label) => { await data.addQuarter(label); closeModal(); }} />
            </div>
            {hasQuarter && (
              <div className="export-row">
                <div>
                  <div className="export-title">Export to Excel</div>
                  <div className="hint">Courses, tasks and modules for {team.name}</div>
                </div>
                <ExportButton
                  quarterId={data.activeQid}
                  quarterLabel={data.activeQuarter?.label}
                  allQuarters={data.quarters}
                  courses={data.allCourses}
                  assignments={data.assignments}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </TeamContext.Provider>
  );
}

// ── Inline add quarter form inside the modal ──
function AddQuarterInline({ onAdd }) {
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleAdd() {
    if (!label.trim()) return;
    setSaving(true); setError('');
    try { await onAdd(label.trim()); setLabel(''); }
    catch (e) { setError(e.message || 'Could not add quarter'); }
    setSaving(false);
  }

  return (
    <div>
      <div className="inline-form">
        <input
          className="form-input"
          placeholder="e.g. Fall 2026"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn-accent" onClick={handleAdd} disabled={saving || !label.trim()}>
          {saving ? 'Adding…' : 'Add quarter'}
        </button>
      </div>
      {error && <div className="form-error" style={{marginTop:10,marginBottom:0}}>{error}</div>}
    </div>
  );
}
