import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'

export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading]         = useState(true)
  const channelId = useRef(`leaderboard_${Math.random()}`)

  useEffect(() => {
    let mounted = true

    async function refetch() {
      const { data } = await supabase
        .from('teams').select('id, team_name, email, cash_balance, total_portfolio_value')
        .order('total_portfolio_value', { ascending: false })
      if (mounted) {
        setLeaderboard((data || []).map((t, i) => ({ ...t, rank: i + 1 })))
        setLoading(false)
      }
    }

    refetch()

    const channel = supabase
      .channel(channelId.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, refetch)
      .subscribe()

    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [])

  return { leaderboard, loading }
}
