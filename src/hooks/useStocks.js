import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'

export function useStocks() {
  const [stocks, setStocks]   = useState([])
  const [loading, setLoading] = useState(true)
  const channelId = useRef(`stocks_${Math.random()}`)

  useEffect(() => {
    let mounted = true

    async function refetch() {
      const { data } = await supabase
        .from('stocks').select('*').eq('is_active', true).order('symbol')
      if (mounted) { setStocks(data || []); setLoading(false) }
    }

    refetch()

    const channel = supabase
      .channel(channelId.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stocks' }, refetch)
      .subscribe()

    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [])

  return { stocks, loading }
}
