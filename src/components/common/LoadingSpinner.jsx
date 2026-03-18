export default function LoadingSpinner({ fullScreen = false, size = 28 }) {
  const spinner = (
    <div
      style={{
        width: size, height: size,
        border: '2px solid #1a2740',
        borderTopColor: '#ffffff',
        borderRadius: '50%',
        animation: 'spin 0.75s linear infinite',
      }}
    />
  )

  if (fullScreen) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#080d18', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="AWIFS" style={{ width: 52, height: 52, borderRadius: '50%', opacity: 0.7 }} />
        {spinner}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      {spinner}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
