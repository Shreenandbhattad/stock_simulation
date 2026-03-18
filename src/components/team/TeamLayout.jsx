import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useGameState } from '../../hooks/useGameState'
import NewsTicker from '../common/NewsTicker'
import RoundTimer from '../common/RoundTimer'
import Portfolio from './Portfolio'
import StockMarket from './StockMarket'
import NewsPanel from './NewsPanel'
import Leaderboard from './Leaderboard'
import TradeHistory from './TradeHistory'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'portfolio',   label: 'Portfolio',    icon: '▦' },
  { id: 'market',      label: 'Market',       icon: '◈' },
  { id: 'news',        label: 'News Feed',    icon: '◉' },
  { id: 'leaderboard', label: 'Leaderboard',  icon: '◎' },
  { id: 'history',     label: 'Trade Log',    icon: '≡' },
]

const STATUS_BADGE = {
  active:  { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80',  label: 'Trading Open' },
  paused:  { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24',  label: 'Paused' },
  ended:   { bg: 'rgba(248,113,113,0.12)', color: '#f87171',  label: 'Ended' },
  waiting: { bg: 'rgba(100,116,139,0.12)', color: '#64748b',  label: 'Not Started' },
}

export default function TeamLayout() {
  const [activeTab, setActiveTab]   = useState('portfolio')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, teamData, logout }  = useAuth()
  const { gameState }               = useGameState()

  const statusInfo = STATUS_BADGE[gameState?.status] || STATUS_BADGE.waiting

  const SB = {
    aside: {
      position: 'fixed', insetY: 0, left: 0, zIndex: 30, width: 220,
      background: '#0a1020', borderRight: '1px solid #1a2740',
      display: 'flex', flexDirection: 'column',
      transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 0.2s ease',
    },
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080d18', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{ ...SB.aside, ...(typeof window !== 'undefined' && window.innerWidth >= 768 ? { position: 'relative', transform: 'none' } : {}) }}
        className="md:relative md:translate-x-0 fixed">

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 18px 16px', borderBottom: '1px solid #1a2740' }}>
          <img src="/logo.png" alt="AWIFS" style={{ width: 34, height: 34, borderRadius: '50%' }} />
          <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 20, letterSpacing: '0.2em', color: '#e2e8f4' }}>AWIFS</span>
        </div>

        {/* Team badge */}
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #1a2740' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Team</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#e2e8f4', marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {teamData?.team_name || user?.email}
          </div>
          {gameState && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusInfo.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: statusInfo.color, fontWeight: 600 }}>{statusInfo.label}</span>
              <span style={{ fontSize: 11, color: '#2a3a55', marginLeft: 4 }}>· R{gameState.round_number}</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`sidebar-item${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => { setActiveTab(tab.id); setSidebarOpen(false) }}
            >
              <span style={{ fontSize: 13, opacity: 0.7 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '10px 10px 14px', borderTop: '1px solid #1a2740' }}>
          <button
            onClick={async () => { await logout(); toast.success('Signed out') }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 13, fontWeight: 500, borderRadius: 7, transition: 'color 0.15s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
          >
            <span>↩</span> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.65)' }}
          className="md:hidden"
        />
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar — always visible, timer on right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 50, borderBottom: '1px solid #1a2740', background: '#0a1020', flexShrink: 0, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}
            >☰</button>
            <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
              {TABS.find(t => t.id === activeTab)?.label}
            </span>
            {gameState && (
              <span style={{ fontSize: 11, color: statusInfo.color, fontWeight: 600 }}>
                · {statusInfo.label} R{gameState.round_number}
              </span>
            )}
          </div>
          <RoundTimer variant="topbar" roundEndTime={gameState?.round_end_time} />
        </div>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 20px' }} className="fade-up">
          {activeTab === 'portfolio'   && <Portfolio />}
          {activeTab === 'market'      && <StockMarket />}
          {activeTab === 'news'        && <NewsPanel />}
          {activeTab === 'leaderboard' && <Leaderboard />}
          {activeTab === 'history'     && <TradeHistory />}
        </main>

        <NewsTicker />
      </div>
    </div>
  )
}
