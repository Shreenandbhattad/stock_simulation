import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = () =>
    supabase.from('teams').select('id, team_name, email, cash_balance, total_portfolio_value')
      .order('total_portfolio_value', { ascending: false })
      .then(({ data }) => {
        setLeaderboard((data || []).map((t, i) => ({ ...t, rank: i + 1 })))
        setLoading(false)
      })

  useEffect(() => {
    fetch()

    const channel = supabase
      .channel('leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, fetch)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  return { leaderboard, loading }
}
