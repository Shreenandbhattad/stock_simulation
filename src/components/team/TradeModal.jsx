import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useGameContext } from '../../contexts/GameContext'
import { buyStock, sellStock } from '../../services/tradeService'
import toast from 'react-hot-toast'

export default function TradeModal({ stock, mode, onClose }) {
  const [qty, setQty]       = useState('')
  const [loading, setLoading] = useState(false)
  const { user }            = useAuth()
  const { gameState, portfolio } = useGameContext()

  const quantity       = parseInt(qty, 10)
  const isValid        = quantity > 0 && Number.isInteger(quantity)
  const cashBalance    = portfolio?.cash_balance || 0
  const maxBuy         = Math.floor(cashBalance / stock.current_price)
  const maxSell        = portfolio?.holdings?.[stock.symbol] || 0
  const totalValue     = isValid ? quantity * stock.current_price : 0
  const tradingEnabled = gameState?.trading_enabled
  const isBuy          = mode === 'buy'

  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  async function handleTrade() {
    if (!isValid) return
    setLoading(true)
    try {
      if (isBuy) { await buyStock({ teamId: user.id, symbol: stock.symbol, quantity }); toast.success(`Bought ${quantity} × ${stock.symbol}`) }
      else        { await sellStock({ teamId: user.id, symbol: stock.symbol, quantity }); toast.success(`Sold ${quantity} × ${stock.symbol}`) }
      onClose()
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 380 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{isBuy ? 'Buy Order' : 'Sell Order'}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f4' }}>{stock.symbol}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 1 }}>{stock.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1a2740', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', color: '#475569', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Price strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', background: '#080d18', borderRadius: 8, marginBottom: 18, border: '1px solid #1a2740' }}>
          <span style={{ fontSize: 12, color: '#475569' }}>Market Price</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#e2e8f4', fontSize: 14 }}>{fmt(stock.current_price)}</span>
        </div>

        {/* Context info */}
        <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {isBuy ? (<>
            <InfoRow label="Your cash"     value={fmt(cashBalance)} />
            <InfoRow label="Max buy"       value={`${Math.min(maxBuy, stock.broker_inventory)} shares`} />
            <InfoRow label="Broker stock"  value={`${stock.broker_inventory} shares`} />
          </>) : (<>
            <InfoRow label="You hold"      value={`${maxSell} shares`} />
            <InfoRow label="Sell price"    value={fmt(stock.current_price)} />
          </>)}
        </div>

        {/* Qty input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>Quantity</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number" min="1"
              max={isBuy ? Math.min(maxBuy, stock.broker_inventory) : maxSell}
              className="input-field"
              placeholder="No. of shares"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
            <button
              className="btn-ghost"
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              onClick={() => setQty(String(isBuy ? Math.min(maxBuy, stock.broker_inventory) : maxSell))}
            >Max</button>
          </div>
        </div>

        {/* Total */}
        {isValid && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#080d18', borderRadius: 8, marginBottom: 18, border: '1px solid #1a2740' }}>
            <span style={{ fontSize: 12, color: '#475569' }}>{isBuy ? 'Total Cost' : 'Total Proceeds'}</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 17, color: isBuy ? '#f87171' : '#4ade80' }}>{fmt(totalValue)}</span>
          </div>
        )}

        {!tradingEnabled && (
          <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, fontSize: 12, color: '#fbbf24', marginBottom: 14 }}>
            Trading is currently paused by the administrator
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            onClick={handleTrade}
            disabled={loading || !isValid || !tradingEnabled}
            style={{
              flex: 1, fontWeight: 700, padding: '10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13.5, transition: 'all 0.18s',
              background: loading || !isValid || !tradingEnabled ? '#1a2740' : isBuy ? '#166534' : '#7f1d1d',
              color: loading || !isValid || !tradingEnabled ? '#2a3a55' : isBuy ? '#4ade80' : '#f87171',
            }}
          >
            {loading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Processing…
            </span> : `Confirm ${isBuy ? 'Buy' : 'Sell'}`}
          </button>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: '#475569' }}>{label}</span>
      <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}
