import { useState } from 'react'
import { useTransactions } from '../../hooks/useTransactions'
import { clearAllTransactions } from '../../services/adminService'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

export default function AllTransactions() {
  const { transactions, loading } = useTransactions(null, 200)
  const [clearing, setClearing] = useState(false)

  if (loading) return <LoadingSpinner />

  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  async function handleClear() {
    if (!window.confirm(`Delete ALL ${transactions.length} transaction records?\n\nThis clears the audit trail for all teams but does NOT affect cash balances or holdings.\n\nThis cannot be undone.`)) return
    setClearing(true)
    try {
      await clearAllTransactions()
      toast.success('All transaction history cleared')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setClearing(false)
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }} className="fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Audit Trail</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f4' }}>
            All Transactions
            <span style={{ fontSize: 14, fontWeight: 400, color: '#475569', marginLeft: 10 }}>({transactions.length})</span>
          </h1>
        </div>
        {transactions.length > 0 && (
          <button onClick={handleClear} disabled={clearing} className="btn-danger" style={{ fontSize: 12.5 }}>
            {clearing ? 'Clearing…' : 'Clear All History'}
          </button>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '55px 1.8fr 1fr 60px 1.4fr 1.4fr 50px' }}>
          <span>Type</span>
          <span>Team</span>
          <span>Stock</span>
          <span style={{ textAlign: 'right' }}>Qty</span>
          <span style={{ textAlign: 'right' }}>Price</span>
          <span style={{ textAlign: 'right' }}>Total</span>
          <span style={{ textAlign: 'right' }}>Rnd</span>
        </div>

        {transactions.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#2a3a55', fontSize: 13 }}>No transactions yet</div>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} className="table-row" style={{ display: 'grid', gridTemplateColumns: '55px 1.8fr 1fr 60px 1.4fr 1.4fr 50px', alignItems: 'center' }}>
              <div>
                <span style={{
                  fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 5, letterSpacing: '0.06em',
                  background: tx.type === 'buy' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                  color: tx.type === 'buy' ? '#4ade80' : '#f87171',
                }}>{tx.type.toUpperCase()}</span>
              </div>
              <div style={{ fontWeight: 500, color: '#e2e8f4', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tx.team_name}
              </div>
              <div style={{ fontWeight: 700, color: '#94a3b8', fontSize: 13 }}>{tx.symbol}</div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: '#94a3b8' }}>{tx.quantity}</div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
                {fmt(tx.price_per_share)}
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: tx.type === 'buy' ? '#f87171' : '#4ade80' }}>
                {tx.type === 'buy' ? '−' : '+'}{fmt(tx.total_value)}
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#2a3a55' }}>R{tx.round || 0}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
