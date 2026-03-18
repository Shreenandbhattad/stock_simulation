import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useGameState } from '../../hooks/useGameState'
import GameControl from './GameControl'
import StockManager from './StockManager'
import NewsPublisher from './NewsPublisher'
import AllTransactions from './AllTransactions'
import TeamOverview from './TeamOverview'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'game',   label: 'Game Control',  icon: '⬡' },
  { id: 'stocks', label: 'Stocks',         icon: '↗' },
  { id: 'news',   label: 'Publish News',   icon: '◈' },
  { id: 'teams',  label: 'Teams',          icon: '◻' },
  { id: 'trades', label: 'Transactions',   icon: '≡' },
]

const STATUS_STYLE = {
  active:  { background: 'rgba(74,222,128,0.12)',  color: '#4ade80',  border: '1px solid rgba(74,222,128,0.2)'  },
  paused:  { background: 'rgba(251,191,36,0.12)',  color: '#fbbf24',  border: '1px solid rgba(251,191,36,0.2)'  },
  ended:   { background: 'rgba(248,113,113,0.12)', color: '#f87171',  border: '1px solid rgba(248,113,113,0.2)' },
  waiting: { background: 'rgba(100,116,139,0.12)', color: '#64748b',  border: '1px solid rgba(100,116,139,0.2)' },
}

export default function AdminLayout() {
  const [activeTab, setActiveTab] = useState('game')
  const [mobileOpen, setMobileOpen] = useState(false)
  const { logout } = useAuth()
  const { gameState } = useGameState()

  const status = gameState?.status || 'waiting'
  const statusStyle = STATUS_STYLE[status] || STATUS_STYLE.waiting

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080d18', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: '#0b1120', borderRight: '1px solid #1a2740',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 18px', borderBottom: '1px solid #1a2740' }}>
          <img src="/logo.png" alt="AWIFS" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#e2e8f4', letterSpacing: '0.12em' }}>AWIFS</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Admin Panel</div>
          </div>
        </div>

        {/* Game status chip */}
        {gameState && (
          <div style={{ padding: '10px 18px', borderBottom: '1px solid #1a2740' }}>
            <span className="badge" style={statusStyle}>
              {status} · R{gameState.round_number}
            </span>
            <div style={{ fontSize: 11, color: '#2a3a55', marginTop: 5 }}>
              Trading {gameState.trading_enabled ? 'OPEN' : 'CLOSED'}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`sidebar-item${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span style={{ fontSize: 14, opacity: 0.7 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid #1a2740' }}>
          <button
            onClick={async () => { await logout(); toast.success('Logged out') }}
            className="sidebar-item"
            style={{ color: '#f87171' }}
          >
            <span style={{ fontSize: 14 }}>↩</span> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 28px' }} className="fade-up">
        {activeTab === 'game'   && <GameControl />}
        {activeTab === 'stocks' && <StockManager />}
        {activeTab === 'news'   && <NewsPublisher />}
        {activeTab === 'teams'  && <TeamOverview />}
        {activeTab === 'trades' && <AllTransactions />}
      </main>
    </div>
  )
}
