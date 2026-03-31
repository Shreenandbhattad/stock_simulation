import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../supabase/client'

const GameContext = createContext(null)

// Single shared context for ALL team dashboard data.
// Uses ONE realtime channel with multiple listeners instead of 6+ separate channels.
export function GameProvider({ children }) {
  const { user } = useAuth()
  const teamId = user?.id

  const [gameState, setGameState]         = useState(null)
  const [stocks, setStocks]               = useState([])
  const [news, setNews]                   = useState([])
  const [portfolio, setPortfolio]         = useState(null)
  const [leaderboard, setLeaderboard]     = useState([])
  const [transactions, setTransactions]   = useState([])
  const [loading, setLoading]             = useState(true)

  const stocksTimerRef      = useRef(null)
  const leaderboardTimerRef = useRef(null)

  useEffect(() => {
    if (!teamId) { setLoading(false); return }

    let mounted = true

    async function fetchGameState() {
      const { data } = await supabase.from('game_state').select('*').eq('id', 'current').single()
      if (mounted && data) setGameState(data)
    }

    async function fetchStocks() {
      const { data } = await supabase.from('stocks').select('*').eq('is_active', true).order('symbol')
      if (mounted) setStocks(data || [])
    }

    async function fetchNews() {
      const { data } = await supabase.from('news').select('*').order('published_at', { ascending: false }).limit(50)
      if (mounted) setNews(data || [])
    }

    async function fetchPortfolio() {
      const { data } = await supabase.from('teams').select('*').eq('id', teamId).single()
      if (mounted && data) setPortfolio(data)
    }

    async function fetchLeaderboard() {
      const { data } = await supabase
        .from('teams').select('id, team_name, email, cash_balance, total_portfolio_value')
        .order('total_portfolio_value', { ascending: false })
      if (mounted) setLeaderboard((data || []).map((t, i) => ({ ...t, rank: i + 1 })))
    }

    async function fetchTransactions() {
      const { data } = await supabase
        .from('transactions').select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false }).limit(50)
      if (mounted) setTransactions(data || [])
    }

    // Fetch all in parallel on mount
    Promise.all([
      fetchGameState(), fetchStocks(), fetchNews(),
      fetchPortfolio(), fetchLeaderboard(), fetchTransactions(),
    ]).then(() => { if (mounted) setLoading(false) })

    // ONE channel for all realtime updates
    const channel = supabase.channel(`team_${teamId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_state', filter: 'id=eq.current' },
        fetchGameState)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'stocks' },
        () => {
          clearTimeout(stocksTimerRef.current)
          stocksTimerRef.current = setTimeout(fetchStocks, 300)
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'news' },
        fetchNews)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'teams' },
        () => {
          fetchPortfolio()
          clearTimeout(leaderboardTimerRef.current)
          leaderboardTimerRef.current = setTimeout(fetchLeaderboard, 400)
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        fetchTransactions)
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'transactions' },
        fetchTransactions)
      .subscribe()

    return () => {
      mounted = false
      clearTimeout(stocksTimerRef.current)
      clearTimeout(leaderboardTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [teamId])

  return (
    <GameContext.Provider value={{ gameState, stocks, news, portfolio, leaderboard, transactions, loading }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGameContext() {
  return useContext(GameContext)
}
