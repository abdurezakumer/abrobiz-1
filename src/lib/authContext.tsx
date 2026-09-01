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
  refreshProfile: () => Promise<void>
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
    setProfile(null)
    setBusiness(null)
    setSubscription(null)
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, name, phone, email_verified_at, terms_accepted_at, privacy_accepted_at, legal_version')
      .eq('id', s.user.id)
      .single()

    if (profileRow) {
      setProfile({
        id: profileRow.id,
        role: profileRow.role,
        name: profileRow.name,
        phone: profileRow.phone,
        email: s.user.email ?? undefined,
        emailVerifiedAt: profileRow.email_verified_at ?? null,
        termsAcceptedAt: profileRow.terms_accepted_at ?? null,
        privacyAcceptedAt: profileRow.privacy_accepted_at ?? null,
        legalVersion: profileRow.legal_version ?? null,
      })
    } else if (profileError) {
      // Keep existing sessions readable during the migration rollout. The
      // production migration adds the full selection above.
      const { data: legacyProfile } = await supabase
        .from('profiles')
        .select('id, role, name, phone, email_verified_at')
        .eq('id', s.user.id)
        .single()
      if (legacyProfile) {
        setProfile({
          id: legacyProfile.id,
          role: legacyProfile.role,
          name: legacyProfile.name,
          phone: legacyProfile.phone,
          email: s.user.email ?? undefined,
          emailVerifiedAt: legacyProfile.email_verified_at ?? null,
        })
      } else {
        setProfile(null)
      }
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

  const refreshProfile = useCallback(async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const currentSession = sessionData.session
    setSession(currentSession)

    if (!currentSession) {
      setProfile(null)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, name, phone, email_verified_at, terms_accepted_at, privacy_accepted_at, legal_version')
      .eq('id', currentSession.user.id)
      .single()

    if (error) throw error
    setProfile(data ? {
      id: data.id,
      role: data.role,
      name: data.name,
      phone: data.phone,
      email: currentSession.user.email ?? undefined,
      emailVerifiedAt: data.email_verified_at ?? null,
      termsAcceptedAt: data.terms_accepted_at ?? null,
      privacyAcceptedAt: data.privacy_accepted_at ?? null,
      legalVersion: data.legal_version ?? null,
    } : null)
  }, [])

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
    <AuthContext.Provider value={{ session, profile, business, subscription, loading, refreshBusiness, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
