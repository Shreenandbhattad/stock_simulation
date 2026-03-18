import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export function useTeamPortfolio(uid) {
  const [portfolio, setPortfolio] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) { setLoading(false); return }

    // Initial fetch
    supabase.from('teams').select('*').eq('id', uid).single()
      .then(({ data }) => { setPortfolio(data); setLoading(false) })

    // Real-time — re-fetch on any change to this team's row
    const channel = supabase
      .channel(`team-${uid}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `id=eq.${uid}` },
        ({ new: row }) => setPortfolio(row)
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [uid])

  return { portfolio, loading }
}
