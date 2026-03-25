import { useGameContext } from '../../contexts/GameContext'

export default function NewsTicker() {
  const { news, gameState } = useGameContext()

  const currentRound = gameState?.round_number || 0
  const currentNews = currentRound > 0
    ? news.filter(n => n.round === currentRound)
    : news

  const S = {
    bar: { height: 54, background: '#060b14', borderTop: '1px solid #1a2740', display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 0 },
    live: { flexShrink: 0, background: '#ffffff', color: '#0b0f1a', fontSize: 15, fontWeight: 800, padding: '0 18px', height: '100%', display: 'flex', alignItems: 'center', letterSpacing: '0.14em' },
    dot: { width: 9, height: 9, background: '#4ade80', borderRadius: '50%', marginRight: 8, animation: 'pulse-dot 1.5s ease-in-out infinite' },
    sep: { width: 1, height: '100%', background: '#1a2740', flexShrink: 0 },
    round: { flexShrink: 0, padding: '0 16px', fontSize: 16, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' },
    empty: { padding: '0 20px', fontSize: 17, color: '#2a3a55', fontStyle: 'italic' },
  }

  if (!currentNews.length) {
    return (
      <div style={S.bar}>
        <div style={S.live}><span style={S.dot} />LIVE</div>
        <div style={S.sep} />
        <span style={S.empty}>Awaiting news from the market floor…</span>
      </div>
    )
  }

  const text = currentNews
    .map((n) => n.headline)
    .join('          ◆          ')

  return (
    <div style={S.bar}>
      <div style={S.live}><span style={S.dot} />LIVE</div>
      <div style={S.sep} />
      {gameState && <div style={S.round}>RND {gameState.round_number}</div>}
      <div style={S.sep} />
      <div className="ticker-wrapper" style={{ flex: 1 }}>
        <div className="ticker-content" style={{ fontSize: 18, color: '#94a3b8', letterSpacing: '0.03em' }}>
          {text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}
        </div>
      </div>
    </div>
  )
}
