import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'

export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading]         = useState(true)
  const channelId = useRef(`leaderboard_${Math.random()}`)

  useEffect(() => {
    let mounted = true
    let debounceTimer = null

    async function refetch() {
      const { data } = await supabase
        .from('teams').select('id, team_name, email, cash_balance, total_portfolio_value')
        .order('total_portfolio_value', { ascending: false })
      if (mounted) {
        setLeaderboard((data || []).map((t, i) => ({ ...t, rank: i + 1 })))
        setLoading(false)
      }
    }

    // Debounced version — collapses bursts of updates (mass trading) into one refetch
    function debouncedRefetch() {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(refetch, 400)
    }

    refetch() // immediate on mount

    const channel = supabase
      .channel(channelId.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, debouncedRefetch)
      .subscribe()

    return () => {
      mounted = false
      clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [])

  return { leaderboard, loading }
}
