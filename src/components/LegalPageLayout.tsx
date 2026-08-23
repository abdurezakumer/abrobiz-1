import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

export default function LegalPageLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div style={{ background: '#0A0C10', color: '#F0EDE7', fontFamily: 'Inter, sans-serif', minHeight: '100vh' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 80px' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(240,237,231,0.5)', fontSize: 14, textDecoration: 'none', marginBottom: 28 }}>
          <ArrowLeft size={15} /> Back to home
        </Link>

        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{title}</h1>
        <p style={{ fontSize: 12.5, color: 'rgba(240,237,231,0.4)', marginBottom: 24 }}>Last updated: {updated}</p>

        <div style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.25)', borderRadius: 12, padding: '14px 18px', marginBottom: 32, fontSize: 13, color: 'rgba(240,237,231,0.7)', lineHeight: 1.6 }}>
          This is a starting draft, not final legal advice — have it reviewed by a lawyer familiar with your local regulations before relying on it.
        </div>

        <div style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(240,237,231,0.7)' }}>{children}</div>
      </div>
    </div>
  )
}
