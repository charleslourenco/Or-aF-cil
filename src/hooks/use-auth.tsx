import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface UserProfile {
  id: string
  email: string
  nome?: string | null
  role: UserRole
  ativo?: boolean
  created_at?: string
  updated_at?: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  isAdmin: boolean
  isEditor: boolean
  isViewer: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfileForUser = useCallback(
    async (userId: string, userEmail?: string, userMeta?: Record<string, any>) => {
      try {
        const { data, error } = await supabase
          .from('profiles' as any)
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (!error && data) {
          setProfile(data as unknown as UserProfile)
        } else {
          // Fallback default profile if not found in db
          const roleFromMeta = (userMeta?.role as UserRole) || 'viewer'
          const nameFromMeta = userMeta?.nome || userMeta?.name || userEmail?.split('@')[0] || ''
          setProfile({
            id: userId,
            email: userEmail || '',
            nome: nameFromMeta,
            role: roleFromMeta,
            ativo: true,
          })
        }
      } catch (err) {
        console.error('Erro ao buscar perfil do usuário:', err)
        const roleFromMeta = (userMeta?.role as UserRole) || 'viewer'
        const nameFromMeta = userMeta?.nome || userMeta?.name || userEmail?.split('@')[0] || ''
        setProfile({
          id: userId,
          email: userEmail || '',
          nome: nameFromMeta,
          role: roleFromMeta,
          ativo: true,
        })
      }
    },
    [],
  )

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfileForUser(user.id, user.email, user.user_metadata)
    }
  }, [user, fetchProfileForUser])

  useEffect(() => {
    // 1. Initial session check
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          fetchProfileForUser(currentUser.id, currentUser.email, currentUser.user_metadata).finally(
            () => {
              setLoading(false)
            },
          )
        } else {
          setProfile(null)
          setLoading(false)
        }
      })
      .catch(() => {
        setLoading(false)
      })

    // 2. Real-time auth changes listener (NO async/await inside callback)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      const currentUser = newSession?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        // trigger profile fetch asynchronously outside callback
        fetchProfileForUser(currentUser.id, currentUser.email, currentUser.user_metadata)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfileForUser])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    return { error: error as Error | null }
  }

  const role = profile?.role || (user?.user_metadata?.role as UserRole) || 'viewer'
  const isAdmin = role === 'admin'
  const isEditor = role === 'editor'
  const isViewer = role === 'viewer'

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isAdmin,
        isEditor,
        isViewer,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
