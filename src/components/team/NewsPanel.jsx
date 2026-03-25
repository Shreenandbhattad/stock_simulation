import { useNews } from '../../hooks/useNews'
import LoadingSpinner from '../common/LoadingSpinner'

export default function NewsPanel() {
  const { news, loading } = useNews(50)
  if (loading) return <LoadingSpinner />

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }} className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Market Intelligence</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f4' }}>News Feed</h1>
      </div>

      {news.length === 0 ? (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: '#2a3a55', fontSize: 13 }}>No market news published yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {news.map((item, idx) => (
            <div key={item.id} className="card" style={{ padding: '18px 20px', borderLeft: idx === 0 ? '3px solid #ffffff' : '3px solid #1a2740' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: '#e2e8f4', lineHeight: 1.45 }}>{item.headline}</div>
                <span className="badge badge-active" style={{ flexShrink: 0, fontSize: 10 }}>Round {item.round}</span>
              </div>
              {item.body && <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 10, lineHeight: 1.55 }}>{item.body}</p>}
              {item.affected_stocks?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: '#475569', alignSelf: 'center' }}>Stocks in play:</span>
                  {item.affected_stocks.map((s) => (
                    <span
                      key={s.symbol}
                      style={{
                        fontSize: 11, fontFamily: 'monospace', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: 'rgba(148,163,184,0.08)',
                        color: '#94a3b8',
                        border: '1px solid rgba(148,163,184,0.15)',
                      }}
                    >
                      {s.symbol}
                    </span>
                  ))}
                </div>
              )}
              {item.published_at && (
                <div style={{ fontSize: 11, color: '#2a3a55', marginTop: 10 }}>
                  {new Date(item.published_at).toLocaleString('en-IN')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
