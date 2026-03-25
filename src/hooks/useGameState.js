import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'

export function useGameState() {
  const [gameState, setGameState] = useState(null)
  const [loading, setLoading]     = useState(true)
  const channelId = useRef(`game_state_${Math.random()}`)

  useEffect(() => {
    let mounted = true

    async function refetch() {
      const { data } = await supabase
        .from('game_state').select('*').eq('id', 'current').single()
      if (mounted) { setGameState(data); setLoading(false) }
    }

    refetch()

    const channel = supabase
      .channel(channelId.current)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_state', filter: 'id=eq.current' },
        refetch
      )
      .subscribe()

    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [])

  return { gameState, loading }
}
