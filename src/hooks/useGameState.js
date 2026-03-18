import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export function useGameState() {
  const [gameState, setGameState] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initial fetch
    supabase.from('game_state').select('*').eq('id', 'current').single()
      .then(({ data }) => { setGameState(data); setLoading(false) })

    // Real-time subscription
    const channel = supabase
      .channel('game_state')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_state', filter: 'id=eq.current' },
        ({ new: row }) => setGameState(row)
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  return { gameState, loading }
}
