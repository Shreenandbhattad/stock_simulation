import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)   // 'admin' | 'team' | null
  const [teamData, setTeamData] = useState(null)
  const [loading, setLoading] = useState(true)

  async function resolveRole(supaUser) {
    if (!supaUser) {
      setUser(null); setRole(null); setTeamData(null)
      return
    }
    // Check admins table first
    const { data: adminRow } = await supabase
      .from('admins')
      .select('id')
      .eq('id', supaUser.id)
      .maybeSingle()

    if (adminRow) {
      setUser(supaUser); setRole('admin'); setTeamData(null)
      return
    }
    // Check teams table
    const { data: teamRow } = await supabase
      .from('teams')
      .select('*')
      .eq('id', supaUser.id)
      .maybeSingle()

    if (teamRow) {
      setUser(supaUser); setRole('team'); setTeamData(teamRow)
    } else {
      // Unknown — sign out
      await supabase.auth.signOut()
      setUser(null); setRole(null); setTeamData(null)
    }
  }

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveRole(session?.user ?? null).finally(() => setLoading(false))
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveRole(session?.user ?? null).finally(() => setLoading(false))
    })

    return () => subscription.unsubscribe()
  }, [])

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, role, teamData, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
