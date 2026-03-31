import { useState } from 'react'
import { useGameContext } from '../../contexts/GameContext'
import LoadingSpinner from '../common/LoadingSpinner'
import PriceTag from '../common/PriceTag'
import TradeModal from './TradeModal'

export default function StockMarket() {
  const { stocks, loading, gameState, portfolio } = useGameContext()
  const [modal, setModal]   = useState(null)
  const [search, setSearch] = useState('')

  if (loading) return <LoadingSpinner />

  const tradingEnabled = gameState?.trading_enabled
  const filtered = stocks.filter(
    (s) => s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }} className="fade-up">
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Live Market</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f4' }}>Order Book</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {gameState && (
            <span
              className="badge"
              style={tradingEnabled
                ? { background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }
                : { background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }
              }
            >
              {tradingEnabled ? '● Trading Open' : '● Trading Closed'}
            </span>
          )}
          <input
            type="text"
            className="input-field"
            style={{ width: 180, padding: '8px 12px', fontSize: 13 }}
            placeholder="Search symbol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '2.5fr 2fr 1fr 1fr 1.4fr' }}>
          <span>Instrument</span>
          <span style={{ textAlign: 'right' }}>Last Price</span>
          <span style={{ textAlign: 'right' }}>Available</span>
          <span style={{ textAlign: 'right' }}>Held</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#2a3a55', fontSize: 13 }}>No instruments found</div>
        ) : (
          filtered.map((stock) => {
            const held = portfolio?.holdings?.[stock.symbol] || 0
            return (
              <div key={stock.symbol} className="table-row" style={{ display: 'grid', gridTemplateColumns: '2.5fr 2fr 1fr 1fr 1.4fr', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#e2e8f4', fontSize: 13.5 }}>{stock.symbol}</div>
                  <div style={{ fontSize: 11.5, color: '#475569', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{stock.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <PriceTag price={stock.current_price} changePercent={stock.price_change_percent} size="sm" />
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: stock.broker_inventory === 0 ? '#f87171' : '#94a3b8' }}>
                  {stock.broker_inventory}
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: held > 0 ? '#ffffff' : '#2a3a55' }}>
                  {held > 0 ? held : '—'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button
                    disabled={!tradingEnabled || stock.broker_inventory === 0}
                    onClick={() => setModal({ stock, mode: 'buy' })}
                    style={{
                      fontSize: 11.5, fontWeight: 700, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                      background: (!tradingEnabled || stock.broker_inventory === 0) ? 'rgba(74,222,128,0.05)' : 'rgba(74,222,128,0.12)',
                      color: (!tradingEnabled || stock.broker_inventory === 0) ? '#1a3a2a' : '#4ade80',
                      opacity: (!tradingEnabled || stock.broker_inventory === 0) ? 0.4 : 1,
                    }}
                  >BUY</button>
                  {held > 0 && (
                    <button
                      disabled={!tradingEnabled}
                      onClick={() => setModal({ stock, mode: 'sell' })}
                      style={{
                        fontSize: 11.5, fontWeight: 700, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                        background: !tradingEnabled ? 'rgba(248,113,113,0.05)' : 'rgba(248,113,113,0.12)',
                        color: !tradingEnabled ? '#3a1a1a' : '#f87171',
                        opacity: !tradingEnabled ? 0.4 : 1,
                      }}
                    >SELL</button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {modal && <TradeModal stock={modal.stock} mode={modal.mode} onClose={() => setModal(null)} />}
    </div>
  )
}
