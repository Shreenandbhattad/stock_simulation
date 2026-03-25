import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'

export function useTransactions(teamId = null, maxItems = 50) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]           = useState(true)
  const channelId = useRef(`transactions_${Math.random()}`)

  useEffect(() => {
    let mounted = true

    async function refetch() {
      let q = supabase.from('transactions').select('*')
        .order('created_at', { ascending: false }).limit(maxItems)
      if (teamId) q = q.eq('team_id', teamId)
      const { data } = await q
      if (mounted) { setTransactions(data || []); setLoading(false) }
    }

    refetch()

    const channel = supabase
      .channel(channelId.current)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, refetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transactions' }, refetch)
      .subscribe()

    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [teamId, maxItems])

  return { transactions, loading }
}
