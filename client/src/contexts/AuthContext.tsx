import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import api from '../lib/api'
import { supabase } from '../lib/supabase'

interface User {
  id: string
  email: string
}

interface Profile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  role: string | null
  storage_quota_bytes: number | null
  storage_used_bytes: number | null
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Sync Supabase session with API token for storage uploads
  const syncSupabaseSession = async (token: string) => {
    try {
      // Set the session directly on the Supabase client
      await supabase.auth.setSession({
        access_token: token,
        refresh_token: token, // Use same token as refresh for now
      })
    } catch (err) {
      console.warn('Could not sync Supabase session:', err)
    }
  }

  // Check for existing session on mount
  useEffect(() => {
    const token = api.getToken()
    if (token) {
      // Sync with Supabase first
      syncSupabaseSession(token)

      api.getMe()
        .then(({ user, profile }) => {
          setUser(user)
          setProfile(profile)
        })
        .catch(() => {
          api.logout()
          supabase.auth.signOut()
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const { user } = await api.register(email, password, displayName)
      setUser(user)
      return { error: null }
    } catch (err) {
      return { error: err as Error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const result = await api.login(email, password)
      setUser(result.user)
      setProfile(result.profile)

      // Sync Supabase session for storage uploads
      if (result.session?.access_token) {
        await syncSupabaseSession(result.session.access_token)
      }

      return { error: null }
    } catch (err) {
      return { error: err as Error }
    }
  }

  const signOut = () => {
    api.logout()
    supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
