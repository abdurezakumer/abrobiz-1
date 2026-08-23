import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { getMyBusiness } from './api/businesses'
import { getSubscription } from './api/subscriptions'
import type { Profile, Business, Subscription } from '../types'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  business: Business | null
  subscription: Subscription | null
  loading: boolean
  refreshBusiness: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  const loadForSession = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null)
      setBusiness(null)
      setSubscription(null)
      return
    }
    // Keep authentication usable while optional Phase 5 migrations are being
    // rolled out. The core profile columns exist in the base schema; the
    // verification timestamp is loaded separately and may not exist yet.
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, role, name, phone')
      .eq('id', s.user.id)
      .single()

    if (profileRow) {
      const { data: verificationRow } = await supabase
        .from('profiles')
        .select('email_verified_at')
        .eq('id', s.user.id)
        .maybeSingle()

      setProfile({
        id: profileRow.id,
        role: profileRow.role,
        name: profileRow.name,
        phone: profileRow.phone,
        email: s.user.email ?? undefined,
        emailVerifiedAt: verificationRow?.email_verified_at ?? null,
      })
    }

    if (profileRow?.role === 'owner') {
      const biz = await getMyBusiness()
      setBusiness(biz)
      if (biz) {
        const sub = await getSubscription(biz.id)
        setSubscription(sub)
      } else {
        setSubscription(null)
      }
    } else {
      setBusiness(null)
      setSubscription(null)
    }
  }, [])

  const refreshBusiness = useCallback(async () => {
    await loadForSession(session)
  }, [session, loadForSession])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      await loadForSession(data.session)
      if (mounted) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      setLoading(true)
      await loadForSession(newSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadForSession])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ session, profile, business, subscription, loading, refreshBusiness, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
