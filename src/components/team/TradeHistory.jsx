import { useGameContext } from '../../contexts/GameContext'
import LoadingSpinner from '../common/LoadingSpinner'

export default function TradeHistory() {
  const { transactions, loading } = useGameContext()
  if (loading) return <LoadingSpinner />

  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }} className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Activity</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f4' }}>Trade Log</h1>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '60px 1.5fr 1fr 1.5fr 1.5fr 60px' }}>
          <span>Type</span><span>Symbol</span><span style={{ textAlign: 'right' }}>Qty</span>
          <span style={{ textAlign: 'right' }}>Price</span><span style={{ textAlign: 'right' }}>Total</span><span style={{ textAlign: 'right' }}>Rnd</span>
        </div>
        {transactions.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#2a3a55', fontSize: 13 }}>No trades executed yet</div>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} className="table-row" style={{ display: 'grid', gridTemplateColumns: '60px 1.5fr 1fr 1.5fr 1.5fr 60px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 5, letterSpacing: '0.06em',
                  background: tx.type === 'buy' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                  color: tx.type === 'buy' ? '#4ade80' : '#f87171',
                }}>
                  {tx.type.toUpperCase()}
                </span>
              </div>
              <div style={{ fontWeight: 600, color: '#e2e8f4', fontSize: 13.5 }}>{tx.symbol}</div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: '#94a3b8' }}>{tx.quantity}</div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12.5, color: '#64748b' }}>{fmt(tx.price_per_share)}</div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13.5, color: tx.type === 'buy' ? '#f87171' : '#4ade80' }}>
                {tx.type === 'buy' ? '−' : '+'}{fmt(tx.total_value)}
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#2a3a55' }}>R{tx.round}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
