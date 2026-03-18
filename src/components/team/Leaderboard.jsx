import { useLeaderboard } from '../../hooks/useLeaderboard'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../common/LoadingSpinner'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const { leaderboard, loading } = useLeaderboard()
  const { user } = useAuth()

  if (loading) return <LoadingSpinner />

  const top = leaderboard[0]?.total_portfolio_value || 0

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }} className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Rankings</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f4' }}>Leaderboard</h1>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto' }}>
          <span>Rank</span>
          <span>Team</span>
          <span style={{ textAlign: 'right' }}>Portfolio Value</span>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#2a3a55', fontSize: 13 }}>No teams registered yet</div>
        ) : (
          leaderboard.map((team) => {
            const isMe = team.id === user?.id
            const pct  = top > 0 ? (team.total_portfolio_value / top) * 100 : 0
            return (
              <div
                key={team.id}
                className="table-row"
                style={{
                  display: 'grid', gridTemplateColumns: '48px 1fr auto', alignItems: 'center', position: 'relative',
                  ...(isMe ? { background: 'rgba(255,255,255,0.04)', borderLeft: '2px solid #ffffff' } : {}),
                }}
              >
                {/* Progress bar background */}
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.03)', width: `${pct}%`, transition: 'width 0.8s ease', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', fontWeight: 700, fontSize: team.rank <= 3 ? 20 : 13, color: team.rank <= 3 ? '#ffffff' : '#475569' }}>
                  {team.rank <= 3 ? MEDALS[team.rank - 1] : `#${team.rank}`}
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: isMe ? '#ffffff' : '#e2e8f4' }}>
                    {team.team_name}
                    {isMe && <span style={{ marginLeft: 8, fontSize: 11, color: '#475569', fontWeight: 400 }}>(you)</span>}
                  </span>
                </div>
                <div style={{ position: 'relative', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#e2e8f4' }}>
                  ₹{(team.total_portfolio_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
