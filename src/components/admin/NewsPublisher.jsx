import { useState } from 'react'
import { useStocks } from '../../hooks/useStocks'
import { useGameState } from '../../hooks/useGameState'
import { useNews } from '../../hooks/useNews'
import { publishNews, deleteNews, clearAllNews, updateNews } from '../../services/adminService'
import toast from 'react-hot-toast'

export default function NewsPublisher() {
  const { stocks } = useStocks()
  const { gameState } = useGameState()
  const { news, loading: newsLoading } = useNews(100)

  // Publish form state
  const [headline, setHeadline]           = useState('')
  const [body, setBody]                   = useState('')
  const [affectedStocks, setAffectedStocks] = useState([{ symbol: '', changePercent: '' }])
  const [publishing, setPublishing]       = useState(false)

  // Edit modal state
  const [editItem, setEditItem]     = useState(null) // { id, headline, body }
  const [editHeadline, setEditHeadline] = useState('')
  const [editBody, setEditBody]     = useState('')
  const [saving, setSaving]         = useState(false)
  const [clearing, setClearing]     = useState(false)

  function addRow() { setAffectedStocks([...affectedStocks, { symbol: '', changePercent: '' }]) }
  function removeRow(idx) { setAffectedStocks(affectedStocks.filter((_, i) => i !== idx)) }
  function updateRow(idx, field, value) {
    setAffectedStocks(affectedStocks.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  async function handlePublish(e) {
    e.preventDefault()
    if (!headline.trim()) { toast.error('Headline is required'); return }
    const validRows = affectedStocks.filter((r) => r.symbol && r.changePercent !== '' && !isNaN(Number(r.changePercent)))
    if (validRows.length === 0) { toast.error('Add at least one affected stock with a price change'); return }

    setPublishing(true)
    try {
      await publishNews({
        headline, body,
        round: gameState?.round_number || 0,
        affectedStocks: validRows.map((r) => ({ symbol: r.symbol, changePercent: Number(r.changePercent) })),
      })
      toast.success('News published — prices updated live!')
      setHeadline(''); setBody(''); setAffectedStocks([{ symbol: '', changePercent: '' }])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setPublishing(false)
    }
  }

  function openEdit(item) {
    setEditItem(item)
    setEditHeadline(item.headline)
    setEditBody(item.body || '')
  }

  async function handleSaveEdit() {
    if (!editHeadline.trim()) { toast.error('Headline cannot be empty'); return }
    setSaving(true)
    try {
      await updateNews(editItem.id, { headline: editHeadline, body: editBody })
      toast.success('News updated')
      setEditItem(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete news flash?\n\n"${item.headline}"\n\nNote: stock prices already changed will NOT be reversed.`)) return
    try {
      await deleteNews(item.id)
      toast.success('News removed from ticker')
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleClearAll() {
    if (!window.confirm(`Delete ALL ${news.length} news items?\n\nStock prices already changed will NOT be reversed. This only clears the ticker.`)) return
    setClearing(true)
    try {
      await clearAllNews()
      toast.success('All news cleared')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setClearing(false)
    }
  }

  const previewRows = affectedStocks.filter((r) => r.symbol && r.changePercent !== '')

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }} className="fade-up">

      {/* Publish Form */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Market Intelligence</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f4' }}>Publish News Flash</h1>
      </div>

      <div className="card" style={{ padding: '24px 24px', marginBottom: 18 }}>
        <form onSubmit={handlePublish}>
          <FieldLabel>Headline *</FieldLabel>
          <input
            type="text" required className="input-field" style={{ marginBottom: 18, fontSize: 14 }}
            placeholder="e.g. RBI raises interest rates by 25bps"
            value={headline} onChange={(e) => setHeadline(e.target.value)}
          />

          <FieldLabel>Description (optional)</FieldLabel>
          <textarea
            className="input-field" style={{ marginBottom: 18, resize: 'none' }} rows={2}
            placeholder="Additional context..."
            value={body} onChange={(e) => setBody(e.target.value)}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <FieldLabel noMargin>Price Impact *</FieldLabel>
            <button type="button" onClick={addRow}
              style={{ fontSize: 11.5, color: '#ffffff', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              + Add Stock
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {affectedStocks.map((row, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="input-field" style={{ flex: 1, fontSize: 13 }} value={row.symbol}
                  onChange={(e) => updateRow(idx, 'symbol', e.target.value)}>
                  <option value="">Select stock</option>
                  {stocks.map((s) => (
                    <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</option>
                  ))}
                </select>
                <div style={{ position: 'relative', width: 140 }}>
                  <input
                    type="number" step="0.1" className="input-field" style={{ fontSize: 13, paddingRight: 28 }}
                    placeholder="e.g. +5 or -8"
                    value={row.changePercent} onChange={(e) => updateRow(idx, 'changePercent', e.target.value)}
                  />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#475569' }}>%</span>
                </div>
                {affectedStocks.length > 1 && (
                  <button type="button" onClick={() => removeRow(idx)}
                    style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
                )}
              </div>
            ))}
          </div>

          {previewRows.length > 0 && (
            <div style={{ background: '#080d18', border: '1px solid #1a2740', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Preview</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#e2e8f4', marginBottom: 10 }}>{headline || '(no headline)'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {previewRows.map((r, i) => {
                  const pct = Number(r.changePercent)
                  return (
                    <span key={i} style={{
                      fontSize: 11, fontFamily: 'monospace', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: pct > 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                      color: pct > 0 ? '#4ade80' : '#f87171',
                      border: `1px solid ${pct > 0 ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                    }}>
                      {r.symbol} {pct > 0 ? '▲' : '▼'}{Math.abs(pct)}%
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          <button type="submit" disabled={publishing} className="btn-primary"
            style={{ width: '100%', fontSize: 14, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {publishing ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#0b0f1a', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Publishing & updating prices…
              </>
            ) : 'Publish News Flash'}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </form>
      </div>

      {/* Published News List */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>
          Published News
          <span style={{ fontSize: 12, fontWeight: 400, color: '#2a3a55', marginLeft: 8 }}>({news.length})</span>
        </div>
        {news.length > 0 && (
          <button onClick={handleClearAll} disabled={clearing} className="btn-danger" style={{ fontSize: 12 }}>
            {clearing ? 'Clearing…' : 'Clear All'}
          </button>
        )}
      </div>

      {newsLoading ? (
        <div style={{ color: '#2a3a55', fontSize: 13, padding: '20px 0' }}>Loading…</div>
      ) : news.length === 0 ? (
        <div style={{ color: '#2a3a55', fontSize: 13, padding: '20px 0' }}>No news published yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {news.map((item) => (
            <div key={item.id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#e2e8f4', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.headline}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: item.body ? 6 : 0 }}>
                  {(item.affected_stocks || []).map((s, i) => {
                    const pct = s.changePercent ?? s.change_percent ?? 0
                    return (
                      <span key={i} style={{
                        fontSize: 10, fontFamily: 'monospace', fontWeight: 700, padding: '2px 7px', borderRadius: 12,
                        background: pct > 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                        color: pct > 0 ? '#4ade80' : '#f87171',
                      }}>
                        {s.symbol} {pct > 0 ? '▲' : '▼'}{Math.abs(pct)}%
                      </span>
                    )
                  })}
                  <span style={{ fontSize: 10, color: '#2a3a55', alignSelf: 'center' }}>
                    R{item.round} · {new Date(item.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {item.body && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{item.body}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(item)}
                  style={{ fontSize: 11.5, fontWeight: 600, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid #1a2740', background: '#0e1524', color: '#94a3b8' }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(item)}
                  style={{ fontSize: 11.5, fontWeight: 600, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', color: '#f87171' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f4' }}>Edit News</h3>
              <button onClick={() => setEditItem(null)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Headline</div>
            <input
              type="text" className="input-field" style={{ marginBottom: 14, fontSize: 14 }}
              value={editHeadline} onChange={(e) => setEditHeadline(e.target.value)}
            />

            <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Description</div>
            <textarea
              className="input-field" style={{ resize: 'none', marginBottom: 6 }} rows={3}
              value={editBody} onChange={(e) => setEditBody(e.target.value)}
            />
            <div style={{ fontSize: 11, color: '#2a3a55', marginBottom: 20 }}>
              Note: editing only updates the headline/description shown in the ticker. Stock prices already applied are not reversed.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditItem(null)} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving} className="btn-primary" style={{ flex: 2 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldLabel({ children, noMargin }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: noMargin ? 0 : 8 }}>
      {children}
    </div>
  )
}
