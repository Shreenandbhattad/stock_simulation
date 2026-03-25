import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'

export function useTeamPortfolio(uid) {
  const [portfolio, setPortfolio] = useState(null)
  const [loading, setLoading]     = useState(true)
  const channelId = useRef(`team_portfolio_${Math.random()}`)

  useEffect(() => {
    if (!uid) { setLoading(false); return }

    let mounted = true

    async function refetch() {
      const { data } = await supabase
        .from('teams').select('*').eq('id', uid).single()
      if (mounted) { setPortfolio(data); setLoading(false) }
    }

    refetch()

    const channel = supabase
      .channel(channelId.current)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `id=eq.${uid}` },
        refetch
      )
      .subscribe()

    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [uid])

  return { portfolio, loading }
}
