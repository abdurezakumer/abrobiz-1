import { Link } from 'react-router-dom'
import { CreditCard, LockKeyhole, Sparkles } from 'lucide-react'
import type { Business, Subscription } from '../types'

export default function SubscriptionExpiredGate({ business, subscription }: { business: Business; subscription: Subscription | null }) {
  return (
    <div style={{ minHeight: 'calc(100vh - 120px)', display: 'grid', placeItems: 'center', padding: '28px 4px' }}>
      <div style={{ width: 'min(680px, 100%)', position: 'relative', overflow: 'hidden', borderRadius: 24, padding: '42px 28px', textAlign: 'center', background: 'linear-gradient(145deg, #111722, #202837)', color: '#F5F3EF', boxShadow: '0 24px 70px rgba(10,12,16,0.2)' }}>
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', right: -80, top: -110, background: 'rgba(212,168,83,0.14)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ width: 58, height: 58, display: 'grid', placeItems: 'center', margin: '0 auto 18px', borderRadius: 18, background: 'rgba(212,168,83,0.16)', color: '#D4A853' }}><LockKeyhole size={25} /></div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#D4A853', fontSize: 12, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase' }}><Sparkles size={14} /> Website access paused</div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 30, lineHeight: 1.12, margin: '13px 0 12px' }}>Your {business.name} website is ready to come back</h1>
          <p style={{ maxWidth: 500, margin: '0 auto', color: 'rgba(245,243,239,0.68)', lineHeight: 1.7, fontSize: 15 }}>Your free trial or subscription has ended. Submit your payment from Billing and the AbroBiz team will review it shortly. Once approved, your website and customer features will unlock automatically.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 26 }}>
            <Link to="/dashboard/billing" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 11, background: '#D4A853', color: '#0A0C10', fontWeight: 700, textDecoration: 'none' }}><CreditCard size={16} /> Renew subscription</Link>
          </div>
          <div style={{ marginTop: 20, color: 'rgba(245,243,239,0.42)', fontSize: 12 }}>Plan: {subscription?.plan?.name ?? 'AbroBiz'} · Powered by AbroBiz</div>
        </div>
      </div>
    </div>
  )
}
