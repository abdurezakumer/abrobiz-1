import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, Package, FolderOpen, ExternalLink, Copy, Check, X, TrendingUp } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabaseClient'
import { listItems } from '../lib/api/items'
import { listCategories } from '../lib/api/categories'
import { daysRemaining } from '../lib/api/subscriptions'
import { publicStorefrontUrl } from '../lib/storefrontUrl'

export default function Dashboard() {
  const { business, subscription } = useAuth()
  const [itemCount, setItemCount] = useState(0)
  const [categoryCount, setCategoryCount] = useState(0)
  const [views7d, setViews7d] = useState(0)
  const [viewsThisMonth, setViewsThisMonth] = useState(0)
  const [viewsLastMonth, setViewsLastMonth] = useState(0)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [demoNoticeVisible, setDemoNoticeVisible] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!business) return
    let active = true
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const previousMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1)
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const noticeKey = `abrobiz:demo-notice-dismissed:${business.id}`
    try { setDemoNoticeVisible(window.localStorage.getItem(noticeKey) !== 'true') } catch { setDemoNoticeVisible(true) }

    void Promise.all([
      listItems(business.id),
      listCategories(business.id),
      supabase.from('page_views').select('id', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', since7d),
      supabase.from('page_views').select('id', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', monthStart.toISOString()),
      supabase.from('page_views').select('id', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', previousMonthStart.toISOString()).lt('created_at', monthStart.toISOString()),
    ]).then(([items, cats, sevenDay, currentMonth, previousMonth]) => {
      if (!active) return
      setItemCount(items.length)
      setCategoryCount(cats.length)
      setViews7d(sevenDay.count ?? 0)
      setViewsThisMonth(currentMonth.count ?? 0)
      setViewsLastMonth(previousMonth.count ?? 0)
    }).catch(() => {
      if (!active) return
      setViews7d(0)
      setViewsThisMonth(0)
      setViewsLastMonth(0)
    }).finally(() => { if (active) setAnalyticsLoading(false) })
    return () => { active = false }
  }, [business])

  if (!business) return null

  const businessId = business.id
  const siteUrl = publicStorefrontUrl(business.slug)
  const days = daysRemaining(subscription?.endDate ?? null)

  function copyLink() {
    navigator.clipboard.writeText(siteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const stats = [
    { label: 'Views (7 days)', value: views7d, icon: Eye },
    { label: 'Views this month', value: viewsThisMonth, icon: TrendingUp },
    { label: 'Items', value: itemCount, icon: Package },
    { label: 'Categories', value: categoryCount, icon: FolderOpen },
  ]

  const monthChange = viewsLastMonth > 0
    ? Math.round(((viewsThisMonth - viewsLastMonth) / viewsLastMonth) * 100)
    : viewsThisMonth > 0 ? 100 : 0
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date())
  const previousMonthLabel = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1))

  function dismissDemoNotice() {
    setDemoNoticeVisible(false)
    try { window.localStorage.setItem(`abrobiz:demo-notice-dismissed:${businessId}`, 'true') } catch { /* Storage may be unavailable. */ }
  }

  return (
    <DashboardLayout>
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 600, color: '#0A0C10' }}>
        Welcome back, {business.name}
      </motion.h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginTop: 4, marginBottom: 28 }}>
        Here's how your site is doing.
      </p>

      {demoNoticeVisible && <div style={{ position: 'relative', background: 'linear-gradient(135deg, rgba(212,168,83,0.14), rgba(255,255,255,0.92))', border: '1px solid rgba(212,168,83,0.28)', borderRadius: 16, padding: '16px 48px 16px 18px', marginBottom: 20 }}>
        <button type="button" onClick={dismissDemoNotice} aria-label="Dismiss demo website notice" title="Dismiss" style={dismissNoticeButton}><X size={15} /></button>
        <div style={{ fontSize: 14, fontWeight: 650, color: '#0A0C10' }}>Your demo website is ready to customize</div>
        <div style={{ fontSize: 13, color: 'rgba(10,12,16,0.58)', marginTop: 5, lineHeight: 1.5 }}>
          Replace the starter story, photos, categories, products or services with your own content. Changes appear on your live site automatically.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <Link to="/dashboard/settings" style={{ color: '#0A0C10', background: '#D4A853', padding: '8px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 650, textDecoration: 'none' }}>Edit website</Link>
          <Link to="/dashboard/catalog" style={{ color: '#0A0C10', background: '#fff', border: '1px solid rgba(10,12,16,0.12)', padding: '8px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 650, textDecoration: 'none' }}>Edit catalog</Link>
        </div>
      </div>}

      {subscription?.status === 'expired' && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 14, color: '#B91C1C', fontWeight: 500 }}>Your subscription has expired. Renew to keep your site live.</span>
          <Link to="/dashboard/billing" style={{ background: '#D4A853', color: '#0A0C10', padding: '8px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
            Renew now
          </Link>
        </div>
      )}
      {subscription?.status !== 'expired' && days !== null && days <= 3 && (
        <div style={{ background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 14, color: '#8A6417', fontWeight: 500 }}>Your {subscription?.status} ends in {days} day{days === 1 ? '' : 's'}.</span>
          <Link to="/dashboard/billing" style={{ background: '#D4A853', color: '#0A0C10', padding: '8px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
            Renew now
          </Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(10,12,16,0.06)' }}>
            <s.icon size={18} color="#D4A853" />
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0A0C10', marginTop: 10, fontFamily: 'Outfit, sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(10,12,16,0.45)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={analyticsCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <div style={analyticsEyebrow}>STOREFRONT ANALYTICS</div>
            <h2 style={analyticsTitle}>A clear view of your reach</h2>
            <p style={analyticsCopy}>Track visits to your public website and compare this month with the previous month.</p>
          </div>
          <div style={analyticsTotal}>
            <span style={{ color: 'rgba(240,237,231,0.58)', fontSize: 11 }}>Current month</span>
            <strong>{analyticsLoading ? '—' : viewsThisMonth.toLocaleString()}</strong>
            <span style={{ color: monthChange >= 0 ? '#D4A853' : '#FCA5A5', fontSize: 12, fontWeight: 700 }}>{monthChange >= 0 ? '+' : ''}{monthChange}% vs {previousMonthLabel}</span>
          </div>
        </div>
        <div style={analyticsBars} aria-label={`${monthLabel} views compared with ${previousMonthLabel}`}>
          <div style={analyticsBarLabel}><span>{previousMonthLabel}</span><strong>{viewsLastMonth.toLocaleString()} views</strong></div>
          <div style={analyticsBarTrack}><div style={{ ...analyticsBarFill, width: `${Math.min(100, Math.max(4, viewsLastMonth ? (viewsLastMonth / Math.max(viewsLastMonth, viewsThisMonth, 1)) * 100 : 4))}%`, background: 'rgba(240,237,231,0.28)' }} /></div>
          <div style={{ ...analyticsBarLabel, marginTop: 12 }}><span>{monthLabel}</span><strong>{analyticsLoading ? 'Loading…' : `${viewsThisMonth.toLocaleString()} views`}</strong></div>
          <div style={analyticsBarTrack}><div style={{ ...analyticsBarFill, width: `${Math.min(100, Math.max(4, viewsThisMonth ? (viewsThisMonth / Math.max(viewsLastMonth, viewsThisMonth, 1)) * 100 : 4))}%` }} /></div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', border: '1px solid rgba(10,12,16,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0A0C10', marginBottom: 10 }}>Your live site</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, background: '#F6F3EE', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, color: 'rgba(10,12,16,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {siteUrl}
          </div>
          <button onClick={copyLink} style={iconBtn}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" style={iconBtn}><ExternalLink size={15} /></a>
        </div>
        {!business.isPublished && (
          <p style={{ fontSize: 12.5, color: '#B45309', marginTop: 10 }}>
            Your site isn't published yet — turn it on from Settings so customers can see it.
          </p>
        )}
      </div>
    </DashboardLayout>
  )
}

const iconBtn: React.CSSProperties = {
  width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10,
  background: '#0A0C10', color: '#F0EDE7', border: 'none', cursor: 'pointer', textDecoration: 'none',
}
const dismissNoticeButton: React.CSSProperties = { position: 'absolute', top: 12, right: 12, width: 30, height: 30, display: 'grid', placeItems: 'center', border: '1px solid rgba(10,12,16,0.1)', borderRadius: 8, background: 'rgba(255,255,255,0.7)', color: '#0A0C10', cursor: 'pointer' }
const analyticsCard: React.CSSProperties = { marginBottom: 24, borderRadius: 20, padding: '24px 26px', color: '#F0EDE7', background: 'linear-gradient(135deg, #11151D 0%, #1D2528 55%, #2B2419 100%)', boxShadow: '0 18px 40px rgba(10,12,16,0.14)', overflow: 'hidden' }
const analyticsEyebrow: React.CSSProperties = { color: '#D4A853', fontSize: 10, fontWeight: 800, letterSpacing: 1.5 }
const analyticsTitle: React.CSSProperties = { margin: '8px 0 7px', fontFamily: 'Outfit, sans-serif', fontSize: 21, fontWeight: 600 }
const analyticsCopy: React.CSSProperties = { margin: 0, maxWidth: 520, color: 'rgba(240,237,231,0.62)', fontSize: 13, lineHeight: 1.6 }
const analyticsTotal: React.CSSProperties = { minWidth: 155, display: 'flex', flexDirection: 'column', gap: 4, padding: '13px 15px', borderRadius: 14, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }
const analyticsBars: React.CSSProperties = { marginTop: 24, maxWidth: 680 }
const analyticsBarLabel: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, color: 'rgba(240,237,231,0.68)', fontSize: 12 }
const analyticsBarTrack: React.CSSProperties = { height: 8, marginTop: 8, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }
const analyticsBarFill: React.CSSProperties = { height: '100%', minWidth: 4, borderRadius: 999, background: 'linear-gradient(90deg, #D4A853, #F0C978)', transition: 'width 400ms ease' }
