export default function PriceTag({ price, changePercent, size = 'md' }) {
  const isUp   = changePercent > 0
  const isDown = changePercent < 0
  const color  = isUp ? '#4ade80' : isDown ? '#f87171' : '#94a3b8'
  const arrow  = isUp ? '▲' : isDown ? '▼' : '—'

  const pxMain = size === 'lg' ? 20 : size === 'sm' ? 12.5 : 13.5
  const pxSub  = size === 'lg' ? 12  : 11

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color, fontFamily: 'monospace', fontWeight: 700, fontSize: pxMain }}>
      <span style={{ fontSize: pxSub }}>{arrow}</span>
      <span>₹{Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      {changePercent !== undefined && changePercent !== null && (
        <span style={{ fontWeight: 400, fontSize: pxSub, opacity: 0.85 }}>
          ({changePercent > 0 ? '+' : ''}{Number(changePercent).toFixed(2)}%)
        </span>
      )}
    </span>
  )
}
