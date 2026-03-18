import { useAuth } from '../../contexts/AuthContext'
import { useTeamPortfolio } from '../../hooks/useTeamPortfolio'
import { useStocks } from '../../hooks/useStocks'
import LoadingSpinner from '../common/LoadingSpinner'
import PriceTag from '../common/PriceTag'

function StatCard({ label, value, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: '#ffffff' } : {}}>{value}</div>
    </div>
  )
}

export default function Portfolio() {
  const { user } = useAuth()
  const { portfolio, loading: pLoading } = useTeamPortfolio(user?.id)
  const { stocks,    loading: sLoading } = useStocks()

  if (pLoading || sLoading) return <LoadingSpinner />

  const stockMap      = Object.fromEntries(stocks.map((s) => [s.symbol, s]))
  const holdings      = portfolio?.holdings || {}
  const holdingRows   = Object.entries(holdings).filter(([, qty]) => qty > 0)
  const cashBalance   = portfolio?.cash_balance || 0
  const totalValue    = portfolio?.total_portfolio_value || cashBalance
  const holdingsValue = holdingRows.reduce((sum, [sym, qty]) => sum + (stockMap[sym]?.current_price || 0) * qty, 0)

  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }} className="fade-up">
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Portfolio Overview</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f4' }}>{portfolio?.team_name}</h1>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Cash Balance"    value={fmt(cashBalance)} />
        <StatCard label="Holdings Value"  value={fmt(holdingsValue)} accent />
        <StatCard label="Total Portfolio" value={fmt(totalValue)} />
      </div>

      {/* Holdings table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1a2740', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Holdings</span>
          <span style={{ fontSize: 11, color: '#475569' }}>{holdingRows.length} position{holdingRows.length !== 1 ? 's' : ''}</span>
        </div>

        {holdingRows.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#2a3a55', fontSize: 13 }}>
            No positions yet — go to Market to start trading
          </div>
        ) : (
          <>
            <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1.2fr' }}>
              <span>Instrument</span>
              <span style={{ textAlign: 'right' }}>Qty</span>
              <span style={{ textAlign: 'right' }}>LTP</span>
              <span style={{ textAlign: 'right' }}>Value</span>
            </div>
            {holdingRows.map(([sym, qty]) => {
              const stock = stockMap[sym]
              const price = stock?.current_price || 0
              const value = price * qty
              return (
                <div
                  key={sym}
                  className="table-row"
                  style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1.2fr', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#e2e8f4', fontSize: 13.5 }}>{sym}</div>
                    <div style={{ fontSize: 11.5, color: '#475569', marginTop: 1 }}>{stock?.name || ''}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13.5, color: '#e2e8f4' }}>{qty}</div>
                  <div style={{ textAlign: 'right' }}>
                    {stock ? <PriceTag price={price} changePercent={stock.price_change_percent} size="sm" /> : <span style={{ color: '#2a3a55' }}>—</span>}
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13.5, fontWeight: 600, color: '#ffffff' }}>
                    {fmt(value)}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
