import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export function useTransactions(teamId = null, maxItems = 50) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = () => {
    let q = supabase.from('transactions').select('*')
      .order('created_at', { ascending: false }).limit(maxItems)
    if (teamId) q = q.eq('team_id', teamId)
    q.then(({ data }) => { setTransactions(data || []); setLoading(false) })
  }

  useEffect(() => {
    fetch()

    const channel = supabase
      .channel(`transactions-${teamId || 'all'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, fetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transactions' }, fetch)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [teamId, maxItems])

  return { transactions, loading }
}
