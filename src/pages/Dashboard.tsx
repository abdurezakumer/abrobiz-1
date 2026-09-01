import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, Package, FolderOpen, ExternalLink, Copy, Check } from 'lucide-react'
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
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!business) return
    listItems(business.id).then(items => setItemCount(items.length))
    listCategories(business.id).then(cats => setCategoryCount(cats.length))
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('page_views')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .gte('created_at', since)
      .then(({ count }) => setViews7d(count ?? 0))
  }, [business])

  if (!business) return null

  const siteUrl = publicStorefrontUrl(business.slug)
  const days = daysRemaining(subscription?.endDate ?? null)

  function copyLink() {
    navigator.clipboard.writeText(siteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const stats = [
    { label: 'Views (7 days)', value: views7d, icon: Eye },
    { label: 'Items', value: itemCount, icon: Package },
    { label: 'Categories', value: categoryCount, icon: FolderOpen },
  ]

  return (
    <DashboardLayout>
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 600, color: '#0A0C10' }}>
        Welcome back, {business.name}
      </motion.h1>
      <p style={{ color: 'rgba(10,12,16,0.5)', fontSize: 14, marginTop: 4, marginBottom: 28 }}>
        Here's how your site is doing.
      </p>

      <div style={{ background: 'linear-gradient(135deg, rgba(212,168,83,0.14), rgba(255,255,255,0.92))', border: '1px solid rgba(212,168,83,0.28)', borderRadius: 16, padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 650, color: '#0A0C10' }}>Your demo website is ready to customize</div>
        <div style={{ fontSize: 13, color: 'rgba(10,12,16,0.58)', marginTop: 5, lineHeight: 1.5 }}>
          Replace the starter story, photos, categories, products or services with your own content. Changes appear on your live site automatically.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <Link to="/dashboard/settings" style={{ color: '#0A0C10', background: '#D4A853', padding: '8px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 650, textDecoration: 'none' }}>Edit website</Link>
          <Link to="/dashboard/catalog" style={{ color: '#0A0C10', background: '#fff', border: '1px solid rgba(10,12,16,0.12)', padding: '8px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 650, textDecoration: 'none' }}>Edit catalog</Link>
        </div>
      </div>

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
