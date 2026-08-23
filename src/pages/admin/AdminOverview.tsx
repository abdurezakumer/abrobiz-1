import { useEffect, useState } from 'react'
import { Building2, CreditCard, TrendingUp, Clock } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { supabase } from '../../lib/supabaseClient'
import { adminListBusinesses, type AdminBusinessRow } from '../../lib/api/businesses'

export default function AdminOverview() {
  const [totalBusinesses, setTotalBusinesses] = useState(0)
  const [activeSubs, setActiveSubs] = useState(0)
  const [pendingPayments, setPendingPayments] = useState(0)
  const [mrr, setMrr] = useState(0)
  const [recent, setRecent] = useState<AdminBusinessRow[]>([])

  useEffect(() => {
    supabase.from('businesses').select('id', { count: 'exact', head: true }).then(({ count }) => setTotalBusinesses(count ?? 0))
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active').then(({ count }) => setActiveSubs(count ?? 0))
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending').then(({ count }) => setPendingPayments(count ?? 0))
    supabase
      .from('subscriptions')
      .select('plans(price_etb, billing_interval)')
      .eq('status', 'active')
      .then(({ data }) => {
        const total = (data ?? []).reduce((sum: number, row: any) => {
          const price = Number(row.plans?.price_etb ?? 0)
          const monthly = row.plans?.billing_interval === 'year' ? price / 12 : price
          return sum + monthly
        }, 0)
        setMrr(Math.round(total))
      })
    adminListBusinesses().then(rows => setRecent(rows.slice(0, 6)))
  }, [])

  const stats = [
    { label: 'Businesses', value: totalBusinesses, icon: Building2 },
    { label: 'Active subscriptions', value: activeSubs, icon: TrendingUp },
    { label: 'Pending payments', value: pendingPayments, icon: Clock, highlight: pendingPayments > 0 },
    { label: 'MRR (ETB)', value: mrr, icon: CreditCard },
  ]

  return (
    <AdminLayout>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 24, fontWeight: 600, color: '#0A0C10', marginBottom: 4 }}>Overview</h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginBottom: 24 }}>Platform-wide snapshot.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 30 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: s.highlight ? '1.5px solid #D4A853' : '1px solid rgba(10,12,16,0.06)' }}>
            <s.icon size={18} color="#D4A853" />
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0A0C10', marginTop: 10, fontFamily: 'Outfit, sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(10,12,16,0.45)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: '#0A0C10', marginBottom: 12 }}>Recent signups</div>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(10,12,16,0.06)', overflow: 'hidden' }}>
        {recent.length === 0 ? (
          <div style={{ padding: 20, fontSize: 13.5, color: 'rgba(10,12,16,0.4)' }}>No businesses yet.</div>
        ) : (
          recent.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', borderBottom: '1px solid rgba(10,12,16,0.05)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{b.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(10,12,16,0.4)' }}>/{b.slug} · owner: {b.ownerName}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: b.isPublished ? '#16A34A' : 'rgba(10,12,16,0.4)' }}>
                {b.isPublished ? 'Live' : 'Draft'}
              </span>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  )
}
