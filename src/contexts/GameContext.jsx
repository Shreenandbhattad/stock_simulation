import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

const GameContext = createContext(null)

// Single shared subscription for game_state, stocks, and news.
// Mount this once (at the dashboard level) so tab switches never re-fetch.
export function GameProvider({ children }) {
  const [gameState, setGameState] = useState(null)
  const [stocks, setStocks]       = useState([])
  const [news, setNews]           = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    let mounted = true

    // Fetch all three in parallel on mount
    async function fetchAll() {
      const [gsRes, stRes, nwRes] = await Promise.all([
        supabase.from('game_state').select('*').eq('id', 'current').single(),
        supabase.from('stocks').select('*').eq('is_active', true).order('symbol'),
        supabase.from('news').select('*').order('published_at', { ascending: false }).limit(50),
      ])
      if (!mounted) return
      if (gsRes.data)  setGameState(gsRes.data)
      if (stRes.data)  setStocks(stRes.data || [])
      if (nwRes.data)  setNews(nwRes.data || [])
      setLoading(false)
    }

    fetchAll()

    const gsChannel = supabase.channel('ctx_game_state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state', filter: 'id=eq.current' },
        async () => {
          const { data } = await supabase.from('game_state').select('*').eq('id', 'current').single()
          if (mounted && data) setGameState(data)
        })
      .subscribe()

    let stocksTimer = null
    const stChannel = supabase.channel('ctx_stocks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stocks' },
        () => {
          clearTimeout(stocksTimer)
          stocksTimer = setTimeout(async () => {
            const { data } = await supabase.from('stocks').select('*').eq('is_active', true).order('symbol')
            if (mounted && data) setStocks(data || [])
          }, 300)
        })
      .subscribe()

    const nwChannel = supabase.channel('ctx_news')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news' },
        async () => {
          const { data } = await supabase.from('news').select('*').order('published_at', { ascending: false }).limit(50)
          if (mounted && data) setNews(data || [])
        })
      .subscribe()

    return () => {
      mounted = false
      clearTimeout(stocksTimer)
      supabase.removeChannel(gsChannel)
      supabase.removeChannel(stChannel)
      supabase.removeChannel(nwChannel)
    }
  }, [])

  return (
    <GameContext.Provider value={{ gameState, stocks, news, loading }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGameContext() {
  return useContext(GameContext)
}
