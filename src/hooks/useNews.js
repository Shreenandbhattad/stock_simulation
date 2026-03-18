import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export function useNews(maxItems = 50) {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = () =>
    supabase.from('news').select('*').order('published_at', { ascending: false }).limit(maxItems)
      .then(({ data }) => { setNews(data || []); setLoading(false) })

  useEffect(() => {
    fetch()

    const channel = supabase
      .channel('news')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news' }, fetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'news' }, fetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'news' }, fetch)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [maxItems])

  return { news, loading }
}
