import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const { login, role, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // Redirect once role is known
  useEffect(() => {
    if (authLoading) return
    if (role === 'admin') navigate('/admin',     { replace: true })
    if (role === 'team')  navigate('/dashboard', { replace: true })
  }, [role, authLoading])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email.trim(), password)
      // navigate happens via the useEffect above once role resolves
    } catch (err) {
      const msg = err.message?.toLowerCase().includes('invalid')
        ? 'Invalid email or password'
        : err.message?.toLowerCase().includes('too many')
        ? 'Too many attempts. Please wait and try again.'
        : err.message || 'Login failed. Check your credentials.'
      toast.error(msg)
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0f1e38 0%, #080d18 60%)' }}
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="w-full max-w-[360px] relative fade-up">
        {/* Logo + branding */}
        <div className="text-center mb-10">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 rounded-full blur-2xl opacity-30" style={{ background: '#ffffff' }} />
            <img
              src="/logo.png"
              alt="AWIFS"
              className="relative w-24 h-24 rounded-full"
              style={{ border: '1.5px solid rgba(255,255,255,0.35)', boxShadow: '0 0 30px rgba(255,255,255,0.12)' }}
            />
          </div>
          <h1 className="font-display text-5xl tracking-[0.2em] text-white mb-1">AWIFS</h1>
          <p style={{ color: '#475569', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Stock Market Simulation
          </p>
        </div>

        {/* Card */}
        <div className="card p-7" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          <h2 style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '22px' }}>
            Participant Login
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Email Address
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="team@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Password
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-1"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px' }}
            >
              {loading
                ? <><div style={{ width: 15, height: 15, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#0b0f1a', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Signing in…</>
                : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#2a3a55', fontSize: '11.5px', marginTop: '20px' }}>
          Use credentials provided by your coordinator
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
