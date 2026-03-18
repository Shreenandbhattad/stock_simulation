import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export function useStocks() {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initial fetch
    supabase.from('stocks').select('*').eq('is_active', true).order('symbol')
      .then(({ data }) => { setStocks(data || []); setLoading(false) })

    // Real-time
    const channel = supabase
      .channel('stocks')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'stocks' },
        () => {
          supabase.from('stocks').select('*').eq('is_active', true).order('symbol')
            .then(({ data }) => setStocks(data || []))
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  return { stocks, loading }
}
