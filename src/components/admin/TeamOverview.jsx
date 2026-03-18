import { useState } from 'react'
import { useLeaderboard } from '../../hooks/useLeaderboard'
import { resetTeam, createTeamAccount, updateTeam, deleteTeam } from '../../services/adminService'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

function ModalShell({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f4' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1a2740', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', color: '#475569', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CreateTeamModal({ onClose }) {
  const [form, setForm] = useState({ teamName: '', email: '', password: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setSaving(true)
    try {
      await createTeamAccount({ teamName: form.teamName, email: form.email, password: form.password })
      toast.success(`Team "${form.teamName}" created!`)
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Create Team" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Team Name">
          <input required className="input-field" placeholder="e.g. Silent Predators" value={form.teamName}
            onChange={(e) => setForm({ ...form, teamName: e.target.value })} autoFocus />
        </Field>
        <Field label="Email">
          <input required type="email" className="input-field" placeholder="team@example.com" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password">
          <input required type="text" className="input-field" style={{ fontFamily: 'monospace' }} placeholder="min 6 characters" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <div style={{ fontSize: 11, color: '#475569', marginTop: 5 }}>Shown as plain text — copy and share with the team.</div>
        </Field>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1 }}>
            {saving ? 'Creating…' : 'Create Team'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function BulkCreateModal({ onClose }) {
  const [text, setText] = useState('')
  const [progress, setProgress] = useState(null) // null | { done, total, errors }
  const [running, setRunning] = useState(false)

  // Expected format per line: Team Name, email@example.com, password
  function parseLines() {
    return text.split('\n')
      .map(l => l.trim()).filter(Boolean)
      .map(line => {
        const parts = line.split(',').map(p => p.trim())
        return { teamName: parts[0] || '', email: parts[1] || '', password: parts[2] || '' }
      })
      .filter(r => r.teamName && r.email && r.password)
  }

  async function handleRun() {
    const rows = parseLines()
    if (!rows.length) { toast.error('No valid rows found'); return }
    setRunning(true)
    const errors = []
    for (let i = 0; i < rows.length; i++) {
      setProgress({ done: i, total: rows.length, errors })
      try {
        await createTeamAccount(rows[i])
      } catch (err) {
        errors.push(`${rows[i].email}: ${err.message}`)
      }
    }
    setProgress({ done: rows.length, total: rows.length, errors })
    setRunning(false)
    if (errors.length === 0) toast.success(`All ${rows.length} teams created!`)
    else toast.error(`${errors.length} failed — see details`)
  }

  const rows = parseLines()

  return (
    <ModalShell title="Bulk Create Teams" onClose={onClose}>
      <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>
        One team per line: <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>Team Name, email, password</span>
      </div>
      <textarea
        className="input-field"
        rows={8}
        placeholder={"Alpha Squad, alpha@example.com, pass123\nBeta Force, beta@example.com, pass456"}
        value={text}
        onChange={e => setText(e.target.value)}
        style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
        disabled={running}
      />
      <div style={{ fontSize: 11, color: '#475569', marginTop: 6, marginBottom: 14 }}>
        {rows.length} team{rows.length !== 1 ? 's' : ''} detected
      </div>

      {progress && (
        <div style={{ marginBottom: 14, background: '#080d18', borderRadius: 7, padding: '10px 14px' }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
            {progress.done}/{progress.total} created
          </div>
          <div style={{ height: 4, background: '#1a2740', borderRadius: 2 }}>
            <div style={{ height: '100%', background: '#ffffff', borderRadius: 2, width: `${(progress.done / progress.total) * 100}%`, transition: 'width 0.3s' }} />
          </div>
          {progress.errors.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#f87171' }}>
              {progress.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }} disabled={running}>
          {progress?.done === progress?.total && progress?.total > 0 ? 'Close' : 'Cancel'}
        </button>
        {(!progress || running) && (
          <button type="button" onClick={handleRun} disabled={running || !rows.length} className="btn-primary" style={{ flex: 1 }}>
            {running ? `Creating ${progress?.done + 1}/${progress?.total}…` : `Create ${rows.length || ''} Teams`}
          </button>
        )}
      </div>
    </ModalShell>
  )
}

function EditTeamModal({ team, onClose }) {
  const [teamName, setTeamName] = useState(team.team_name)
  const [cashBalance, setCashBalance] = useState(String(team.cash_balance))
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const cash = parseFloat(cashBalance)
    if (isNaN(cash) || cash < 0) { toast.error('Enter a valid cash balance'); return }
    setSaving(true)
    try {
      await updateTeam(team.id, { teamName, cashBalance: cash })
      toast.success(`${teamName} updated`)
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Edit Team" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Team Name">
          <input required className="input-field" value={teamName}
            onChange={(e) => setTeamName(e.target.value)} autoFocus />
        </Field>
        <Field label="Cash Balance (₹)">
          <input required type="number" min="0" step="0.01" className="input-field" value={cashBalance}
            onChange={(e) => setCashBalance(e.target.value)} />
          <div style={{ fontSize: 11, color: '#475569', marginTop: 5 }}>Current: {fmt(team.cash_balance)}</div>
        </Field>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  )
}

export default function TeamOverview() {
  const { leaderboard, loading } = useLeaderboard()
  const [showCreate, setShowCreate] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [editTeam, setEditTeam] = useState(null)

  if (loading) return <LoadingSpinner />

  async function handleDelete(team) {
    if (!window.confirm(`Delete "${team.team_name}"? This cannot be undone.`)) return
    try {
      await deleteTeam(team.id)
      toast.success(`${team.team_name} deleted`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleReset(team) {
    if (!window.confirm(`Reset ${team.team_name} to ₹1,00,000? This clears all holdings!`)) return
    try {
      await resetTeam(team.id)
      toast.success(`${team.team_name} reset`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }} className="fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Administration</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f4' }}>Teams ({leaderboard.length})</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowBulk(true)} className="btn-secondary" style={{ fontSize: 12.5 }}>Bulk Import</button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ Create Team</button>
        </div>
      </div>

      <div className="card" style={{ padding: '12px 18px', marginBottom: 16, fontSize: 12, color: '#475569' }}>
        <strong style={{ color: '#64748b' }}>Tip:</strong> Starting cash is ₹1,00,000 per team. Teams log in at <span style={{ color: '#ffffff', fontFamily: 'monospace' }}>/login</span> with their email + password.
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '40px 1.8fr 1.4fr 1.4fr 1fr' }}>
          <span>#</span>
          <span>Team / Email</span>
          <span style={{ textAlign: 'right' }}>Cash</span>
          <span style={{ textAlign: 'right' }}>Portfolio</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#2a3a55', marginBottom: 14 }}>No teams yet</div>
            <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ fontSize: 12.5 }}>Create your first team</button>
          </div>
        ) : (
          leaderboard.map((team) => (
            <div key={team.id} className="table-row" style={{ display: 'grid', gridTemplateColumns: '40px 1.8fr 1.4fr 1.4fr 1fr', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>#{team.rank}</div>
              <div>
                <div style={{ fontWeight: 600, color: '#e2e8f4', fontSize: 13.5 }}>{team.team_name}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>{team.email}</div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12.5, color: '#94a3b8' }}>
                {fmt(team.cash_balance)}
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#ffffff' }}>
                {fmt(team.total_portfolio_value)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 5 }}>
                <button
                  onClick={() => setEditTeam(team)}
                  style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: '1px solid #2a3a55', background: 'transparent', color: '#64748b', transition: 'all 0.15s' }}
                  onMouseEnter={(e) => { e.target.style.borderColor = '#ffffff'; e.target.style.color = '#ffffff' }}
                  onMouseLeave={(e) => { e.target.style.borderColor = '#2a3a55'; e.target.style.color = '#64748b' }}
                >Edit</button>
                <button
                  onClick={() => handleReset(team)}
                  style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: '1px solid rgba(251,191,36,0.2)', background: 'transparent', color: '#fbbf24', transition: 'all 0.15s' }}
                >Reset</button>
                <button
                  onClick={() => handleDelete(team)}
                  style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: '1px solid rgba(248,113,113,0.2)', background: 'transparent', color: '#f87171', transition: 'all 0.15s' }}
                >Del</button>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} />}
      {showBulk && <BulkCreateModal onClose={() => setShowBulk(false)} />}
      {editTeam && <EditTeamModal team={editTeam} onClose={() => setEditTeam(null)} />}
    </div>
  )
}
