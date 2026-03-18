import { useTimer } from '../../hooks/useTimer'

function fmt(n) { return String(n).padStart(2, '0') }

// roundEndTime: ISO timestamp string from gameState.round_end_time (passed from parent)
// variant: 'full' (admin) | 'topbar' (team top bar)
export default function RoundTimer({ roundEndTime, variant = 'full' }) {
  const secondsLeft = useTimer(roundEndTime)

  if (secondsLeft === null) return null

  const h = Math.floor(secondsLeft / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  const s = secondsLeft % 60
  const display = h > 0
    ? `${fmt(h)}:${fmt(m)}:${fmt(s)}`
    : `${fmt(m)}:${fmt(s)}`

  const expired = secondsLeft === 0
  const urgent  = secondsLeft <= 30 && !expired
  const color   = expired ? '#f87171' : urgent ? '#fbbf24' : '#4ade80'
  const label   = expired ? 'Time Up' : 'Round Timer'

  if (variant === 'topbar') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#080d18',
        border: `1px solid ${expired ? 'rgba(248,113,113,0.35)' : urgent ? 'rgba(251,191,36,0.35)' : 'rgba(74,222,128,0.25)'}`,
        borderRadius: 8, padding: '5px 14px',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', animation: expired ? 'none' : 'pulse-dot 1.5s ease-in-out infinite' }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, color, letterSpacing: '0.04em', lineHeight: 1 }}>
          {display}
        </span>
      </div>
    )
  }

  // Full variant (admin game control card)
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      background: '#080d18', border: `1px solid ${color}33`,
      borderRadius: 10, padding: '12px 22px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 38, fontWeight: 800, color, letterSpacing: '0.06em', lineHeight: 1 }}>
        {display}
      </div>
    </div>
  )
}
