import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'

export function useNews(maxItems = 50) {
  const [news, setNews]       = useState([])
  const [loading, setLoading] = useState(true)
  const channelId = useRef(`news_${Math.random()}`)

  useEffect(() => {
    let mounted = true

    async function refetch() {
      const { data } = await supabase
        .from('news').select('*').order('published_at', { ascending: false }).limit(maxItems)
      if (mounted) { setNews(data || []); setLoading(false) }
    }

    refetch()

    const channel = supabase
      .channel(channelId.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news' }, refetch)
      .subscribe()

    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [maxItems])

  return { news, loading }
}
