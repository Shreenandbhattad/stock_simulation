import { useState, useEffect, useRef } from 'react'
import { useGameState } from '../../hooks/useGameState'
import { useTimer } from '../../hooks/useTimer'
import { useStocks } from '../../hooks/useStocks'
import {
  setGameState, initGameState, restartGame,
  saveRoundDurations, saveScheduledNews,
  startRoundTimer, pauseRoundTimer, resumeRoundTimer, clearRoundTimer,
  publishNews,
} from '../../services/adminService'
import RoundTimer from '../common/RoundTimer'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

const NUM_ROUNDS = 6
const DEFAULT_DURATIONS = Array(NUM_ROUNDS).fill(10) // minutes

const STATUS_STYLE = {
  active:  { background: 'rgba(74,222,128,0.12)',  color: '#4ade80',  border: '1px solid rgba(74,222,128,0.2)'  },
  paused:  { background: 'rgba(251,191,36,0.12)',  color: '#fbbf24',  border: '1px solid rgba(251,191,36,0.2)'  },
  ended:   { background: 'rgba(248,113,113,0.12)', color: '#f87171',  border: '1px solid rgba(248,113,113,0.2)' },
  waiting: { background: 'rgba(100,116,139,0.12)', color: '#64748b',  border: '1px solid rgba(100,116,139,0.2)' },
}

function makeNewsItem(round = 1) {
  return { _id: Math.random().toString(36).slice(2), round, headline: '', body: '', stocks: [{ symbol: '', changePercent: '' }] }
}

export default function GameControl() {
  const { gameState, loading } = useGameState()
  const { stocks } = useStocks()
  const secondsLeft = useTimer(gameState?.round_end_time)

  const [saving, setSaving]               = useState(false)
  const [durations, setDurations]         = useState(DEFAULT_DURATIONS)
  const [durationsLoaded, setDurationsLoaded] = useState(false)
  const [schedNews, setSchedNews]         = useState([])    // pre-scheduled news items
  const [schedLoaded, setSchedLoaded]     = useState(false)
  const autoPausedRef = useRef(false)

  // Load saved durations from DB on first load
  useEffect(() => {
    if (gameState?.round_durations && !durationsLoaded) {
      const rd = gameState.round_durations
      setDurations(DEFAULT_DURATIONS.map((def, i) => {
        const v = rd[i + 1] ?? rd[String(i + 1)]
        return v ? Math.round(v / 60) : def
      }))
      setDurationsLoaded(true)
    }
  }, [gameState?.round_durations, durationsLoaded])

  // Load saved scheduled news from DB on first load
  useEffect(() => {
    if (gameState && !schedLoaded) {
      const sn = gameState.scheduled_news
      setSchedNews(Array.isArray(sn) && sn.length > 0
        ? sn.map(n => ({ ...n, _id: n._id || Math.random().toString(36).slice(2) }))
        : [])
      setSchedLoaded(true)
    }
  }, [gameState, schedLoaded])

  // Auto-pause when timer reaches 0
  useEffect(() => {
    if (secondsLeft === 0 && gameState?.trading_enabled && !autoPausedRef.current) {
      autoPausedRef.current = true
      const roundNum = gameState.round_number
      setGameState({ status: 'paused', tradingEnabled: false, roundNumber: roundNum, roundEndTime: null, timerPausedRemaining: 0 })
        .then(() => toast.success(`⏱ Round ${roundNum} over — trading paused`))
        .catch(err => toast.error(err.message))
    }
    if (secondsLeft > 0) autoPausedRef.current = false
  }, [secondsLeft, gameState?.trading_enabled, gameState?.round_number])

  async function handleAction(action) {
    setSaving(true)
    try {
      const current = gameState || { round_number: 0, status: 'waiting', trading_enabled: false }

      switch (action) {
        case 'init':
          await initGameState()
          toast.success('Game initialized')
          break

        case 'start-round': {
          const next    = (current.round_number || 0) + 1
          const durMins = durations[next - 1] ?? 10

          await setGameState({ status: 'active', tradingEnabled: true, roundNumber: next, timerPausedRemaining: null })
          await startRoundTimer(durMins * 60)

          // Auto-publish all pre-scheduled news for this round
          const toPublish = schedNews.filter(n =>
            Number(n.round) === next &&
            n.headline.trim() &&
            n.stocks.some(s => s.symbol && s.changePercent !== '' && !isNaN(Number(s.changePercent)))
          )
          for (const item of toPublish) {
            const validStocks = item.stocks.filter(s => s.symbol && s.changePercent !== '' && !isNaN(Number(s.changePercent)))
            await publishNews({
              headline: item.headline,
              body: item.body || '',
              round: next,
              affectedStocks: validStocks.map(s => ({ symbol: s.symbol, changePercent: Number(s.changePercent) })),
            })
          }

          if (toPublish.length > 0)
            toast.success(`Round ${next} started — ${toPublish.length} news flash${toPublish.length > 1 ? 'es' : ''} auto-published!`)
          else
            toast.success(`Round ${next} started — ${durMins}min timer running!`)
          break
        }

        case 'pause':
          await setGameState({ status: 'paused', tradingEnabled: false, roundNumber: current.round_number })
          await pauseRoundTimer()
          toast.success('Trading paused')
          break

        case 'resume':
          await setGameState({ status: 'active', tradingEnabled: true, roundNumber: current.round_number })
          await resumeRoundTimer()
          toast.success('Trading resumed')
          break

        case 'end': {
          await setGameState({ status: 'ended', tradingEnabled: false, roundNumber: current.round_number, roundEndTime: null, timerPausedRemaining: null })
          toast.success('Game ended — final prices updated, leaderboard is live!')
          break
        }

        case 'restart':
          if (!window.confirm('Restart the game?\n\n• Round resets to 0\n• ALL teams reset to ₹1,00,000\n• Holdings cleared\n\nThis cannot be undone.')) { setSaving(false); return }
          await restartGame()
          toast.success('Game restarted — all teams reset to ₹1,00,000')
          break
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDurations() {
    setSaving(true)
    try {
      const durObj = {}
      durations.forEach((mins, i) => { durObj[i + 1] = mins * 60 })
      await saveRoundDurations(durObj)
      toast.success('Round durations saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveScheduledNews() {
    setSaving(true)
    try {
      // Strip local _id before saving, but keep it in state for React keys
      const toSave = schedNews.map(({ _id, ...rest }) => ({ ...rest, _id }))
      await saveScheduledNews(toSave)
      toast.success('Scheduled news saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Scheduled news helpers
  function addNewsItem() { setSchedNews(prev => [...prev, makeNewsItem(Math.max(1, (gameState?.round_number || 0) + 1))]) }
  function removeNewsItem(id) { setSchedNews(prev => prev.filter(n => n._id !== id)) }
  function updateNewsItem(id, field, value) { setSchedNews(prev => prev.map(n => n._id === id ? { ...n, [field]: value } : n)) }
  function addStock(id) { setSchedNews(prev => prev.map(n => n._id === id ? { ...n, stocks: [...n.stocks, { symbol: '', changePercent: '' }] } : n)) }
  function removeStock(id, si) { setSchedNews(prev => prev.map(n => n._id === id ? { ...n, stocks: n.stocks.filter((_, i) => i !== si) } : n)) }
  function updateStock(id, si, field, value) {
    setSchedNews(prev => prev.map(n => n._id === id ? {
      ...n, stocks: n.stocks.map((s, i) => i === si ? { ...s, [field]: value } : s)
    } : n))
  }

  if (loading) return <LoadingSpinner />

  const status         = gameState?.status || 'uninitialized'
  const round          = gameState?.round_number || 0
  const tradingEnabled = gameState?.trading_enabled || false
  const statusStyle    = STATUS_STYLE[status] || STATUS_STYLE.waiting

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }} className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Control Panel</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f4' }}>Game Control</h1>
      </div>

      {/* Status strip */}
      <div className="card" style={{ padding: '22px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 22 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            <StatBox label="Status"><span className="badge" style={statusStyle}>{status}</span></StatBox>
            <StatBox label="Round"><div style={{ fontSize: 32, fontWeight: 800, color: '#e2e8f4', fontFamily: 'monospace' }}>{round}</div></StatBox>
            <StatBox label="Trading">
              <span className="badge" style={tradingEnabled ? STATUS_STYLE.active : STATUS_STYLE.ended}>
                {tradingEnabled ? 'OPEN' : 'CLOSED'}
              </span>
            </StatBox>
          </div>
          {secondsLeft !== null && <RoundTimer roundEndTime={gameState?.round_end_time} />}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {!gameState && <button onClick={() => handleAction('init')} disabled={saving} className="btn-primary">Initialize Game</button>}
          {(status === 'waiting' || status === 'paused' || status === 'active') && gameState && (
            <button onClick={() => handleAction('start-round')} disabled={saving} className="btn-primary">
              {status === 'waiting' ? 'Start Round 1' : `Start Round ${round + 1}`}
            </button>
          )}
          {status === 'active' && tradingEnabled && (
            <button onClick={() => handleAction('pause')} disabled={saving} className="btn-secondary">Pause Trading</button>
          )}
          {status === 'paused' && (
            <button onClick={() => handleAction('resume')} disabled={saving} className="btn-secondary">
              Resume Trading{gameState?.timer_paused_remaining > 0 ? ` (${Math.floor(gameState.timer_paused_remaining / 60)}m ${gameState.timer_paused_remaining % 60}s left)` : ''}
            </button>
          )}
          {(status === 'active' || status === 'paused') && (
            <button onClick={() => window.confirm('End the game permanently?') && handleAction('end')} disabled={saving} className="btn-danger">End Game</button>
          )}
          {gameState && status !== 'waiting' && (
            <button onClick={() => handleAction('restart')} disabled={saving}
              style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', fontWeight: 700, padding: '9px 22px', borderRadius: 7, cursor: 'pointer', fontSize: 13.5 }}>
              ↺ Restart Game
            </button>
          )}
        </div>
      </div>

      {/* Round Durations */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1a2740', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Round Durations</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#2a3a55' }}>Set before game starts</div>
            <button onClick={handleSaveDurations} disabled={saving} className="btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>Save</button>
          </div>
        </div>
        <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px' }}>
          <span>Round</span><span>Duration</span><span style={{ textAlign: 'right' }}>Override</span>
        </div>
        {durations.map((mins, i) => {
          const roundNum  = i + 1
          const isCurrent = round === roundNum
          const pausedRem = gameState?.timer_paused_remaining
          return (
            <div key={i} className="table-row" style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px', alignItems: 'center', background: isCurrent ? 'rgba(255,255,255,0.03)' : undefined }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: isCurrent ? '#e2e8f4' : '#475569' }}>
                R{roundNum} {isCurrent && <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: '1px 5px', marginLeft: 4 }}>now</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number" min="1" max="180" value={mins}
                  onChange={(e) => setDurations(prev => { const n = [...prev]; n[i] = Number(e.target.value) || 1; return n })}
                  style={{ width: 64, background: '#080d18', border: '1px solid #1a2740', borderRadius: 6, padding: '5px 8px', color: '#e2e8f4', fontSize: 13, fontFamily: 'monospace', outline: 'none' }}
                />
                <span style={{ fontSize: 12, color: '#475569' }}>min</span>
                {isCurrent && pausedRem > 0 && (
                  <span style={{ fontSize: 11, color: '#fbbf24' }}>({Math.floor(pausedRem / 60)}m{pausedRem % 60}s paused)</span>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <button
                  onClick={async () => {
                    setSaving(true)
                    try { await startRoundTimer(mins * 60); toast.success(`R${roundNum} timer set to ${mins}min`) }
                    catch (e) { toast.error(e.message) }
                    finally { setSaving(false) }
                  }}
                  disabled={saving}
                  style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#64748b' }}
                >▶</button>
              </div>
            </div>
          )
        })}
        {secondsLeft !== null && (
          <div style={{ padding: '10px 18px', borderTop: '1px solid #1a2740', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={async () => { setSaving(true); try { await clearRoundTimer(); toast.success('Timer cleared') } catch (e) { toast.error(e.message) } finally { setSaving(false) } }}
              disabled={saving}
              style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', color: '#f87171' }}
            >■ Clear Timer</button>
          </div>
        )}
      </div>

      {/* Scheduled News */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1a2740', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Scheduled News Flashes</div>
            <div style={{ fontSize: 11, color: '#2a3a55', marginTop: 2 }}>Auto-publish when that round starts — configure before the game</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addNewsItem} style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#94a3b8' }}>+ Add News</button>
            <button onClick={handleSaveScheduledNews} disabled={saving} className="btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>Save All</button>
          </div>
        </div>

        {schedNews.length === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: '#2a3a55', fontSize: 13 }}>
            No scheduled news. Click <span style={{ color: '#94a3b8', fontWeight: 600 }}>+ Add News</span> to pre-configure news flashes for each round.
          </div>
        ) : (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {schedNews.map((item) => {
              const newsForRound = schedNews.filter(n => Number(n.round) === Number(item.round)).length
              const isCurrentRound = Number(item.round) === round
              return (
                <div key={item._id} style={{
                  background: '#080d18',
                  border: `1px solid ${isCurrentRound ? 'rgba(74,222,128,0.2)' : '#1a2740'}`,
                  borderRadius: 8, padding: '14px 16px',
                }}>
                  {/* Row 1: Round + headline + remove */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <select
                      value={item.round}
                      onChange={(e) => updateNewsItem(item._id, 'round', Number(e.target.value))}
                      style={{ width: 80, background: '#0e1524', border: '1px solid #1a2740', borderRadius: 6, padding: '6px 8px', color: '#e2e8f4', fontSize: 12, fontWeight: 700, outline: 'none', cursor: 'pointer' }}
                    >
                      {Array.from({ length: NUM_ROUNDS }, (_, i) => (
                        <option key={i + 1} value={i + 1}>R{i + 1}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="News headline…"
                      value={item.headline}
                      onChange={(e) => updateNewsItem(item._id, 'headline', e.target.value)}
                      style={{ flex: 1, background: '#0e1524', border: '1px solid #1a2740', borderRadius: 6, padding: '6px 10px', color: '#e2e8f4', fontSize: 13, outline: 'none' }}
                    />
                    <button onClick={() => removeNewsItem(item._id)}
                      style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>×</button>
                  </div>

                  {/* Row 2: Stock impacts */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {item.stocks.map((s, si) => (
                      <div key={si} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <select
                          value={s.symbol}
                          onChange={(e) => updateStock(item._id, si, 'symbol', e.target.value)}
                          style={{ background: '#0e1524', border: '1px solid #1a2740', borderRadius: 5, padding: '4px 6px', color: s.symbol ? '#e2e8f4' : '#475569', fontSize: 12, outline: 'none', cursor: 'pointer', maxWidth: 130 }}
                        >
                          <option value="">Stock…</option>
                          {stocks.map(st => <option key={st.symbol} value={st.symbol}>{st.symbol}</option>)}
                        </select>
                        <input
                          type="number" step="0.1" placeholder="±%"
                          value={s.changePercent}
                          onChange={(e) => updateStock(item._id, si, 'changePercent', e.target.value)}
                          style={{ width: 62, background: '#0e1524', border: '1px solid #1a2740', borderRadius: 5, padding: '4px 6px', color: '#e2e8f4', fontSize: 12, outline: 'none', fontFamily: 'monospace' }}
                        />
                        {item.stocks.length > 1 && (
                          <button onClick={() => removeStock(item._id, si)}
                            style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => addStock(item._id)}
                      style={{ fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 5, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#475569' }}>
                      + Stock
                    </button>
                  </div>

                  {/* Preview chips */}
                  {item.stocks.some(s => s.symbol && s.changePercent !== '') && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                      {item.stocks.filter(s => s.symbol && s.changePercent !== '').map((s, i) => {
                        const pct = Number(s.changePercent)
                        return (
                          <span key={i} style={{
                            fontSize: 10, fontFamily: 'monospace', fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                            background: pct > 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                            color: pct > 0 ? '#4ade80' : '#f87171',
                          }}>
                            {s.symbol} {pct > 0 ? '▲' : '▼'}{Math.abs(pct)}%
                          </span>
                        )
                      })}
                      {isCurrentRound && <span style={{ fontSize: 10, color: '#4ade80', alignSelf: 'center', marginLeft: 4 }}>● live round</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* How-to */}
      <div className="card" style={{ padding: '18px 22px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>How Rounds Work</div>
        {[
          ['Set Durations', 'Fill in minutes per round, click Save'],
          ['Schedule News', 'Add news flashes for each round — auto-publish on Start Round'],
          ['Start Round', 'Timer starts, trading opens, and news flashes publish (prices unchanged)'],
          ['Timer Ends', 'Trading pauses and news-driven price changes apply — teams see the new prices'],
          ['Repeat', 'Start next round; teams trade on the updated prices and new news'],
        ].map(([step, desc], i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1a2740', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
            <div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#e2e8f4' }}>{step}</span>
              <span style={{ fontSize: 12, color: '#475569' }}> — {desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatBox({ label, children }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}
