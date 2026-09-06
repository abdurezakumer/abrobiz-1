import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react'
import type { ReactNode } from 'react'
import AbroBizLogo from './AbroBizLogo'

export default function LegalPageLayout({ title, updated, children, navLinks }: { title: string; updated: string; children: ReactNode; navLinks?: { href: string; label: string }[] }) {
  return (
    <div style={{ minHeight: '100vh', background: '#080A0E', color: '#F0EDE7', fontFamily: 'Inter, sans-serif' }}>
      <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 12% 0%, rgba(212,168,83,0.12), transparent 32%), radial-gradient(circle at 88% 20%, rgba(73,101,131,0.12), transparent 28%)' }} />
      <header style={{ position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,10,14,0.82)', backdropFilter: 'blur(16px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <Link to="/" style={{ textDecoration: 'none' }}><AbroBizLogo size={30} /></Link>
          <nav aria-label="Legal navigation" style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="legal-nav">
            <Link to="/terms" style={navStyle}>Terms</Link>
            <Link to="/privacy" style={navStyle}>Privacy</Link>
            <Link to="/" style={{ ...navStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={14} /> Home</Link>
          </nav>
        </div>
      </header>

      <main style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', padding: '64px 24px 96px' }}>
        <div style={{ maxWidth: 780, marginBottom: 42 }}>
          <div style={eyebrowStyle}>ABROBIZ LEGAL CENTRE</div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(36px, 6vw, 58px)', lineHeight: 1.02, letterSpacing: '-0.04em', margin: '14px 0 16px' }}>{title}</h1>
          <p style={{ margin: 0, maxWidth: 650, color: 'rgba(240,237,231,0.62)', fontSize: 16, lineHeight: 1.7 }}>Clear, plain-language information about using AbroBiz and how we handle information across the platform.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
            <span style={metaPill}>Last updated · {updated}</span>
            <span style={metaPill}>Applies to AbroBiz accounts and storefronts</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 250px', gap: 46, alignItems: 'start' }} className="legal-grid">
          <article style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 24, padding: '32px clamp(22px, 4vw, 48px)', boxShadow: '0 24px 70px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 26, marginBottom: 28, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <CheckCircle2 size={20} color="#D4A853" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, color: 'rgba(240,237,231,0.65)', fontSize: 13.5, lineHeight: 1.7 }}>This page is written to be easy to understand. It describes the current AbroBiz service and may be supplemented by plan-specific terms or notices shown in the product.</p>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: 'rgba(240,237,231,0.72)' }}>{children}</div>
          </article>

          <aside style={{ position: 'sticky', top: 24 }} className="legal-aside">
            <div style={asideCard}>
              <div style={asideLabel}>On this page</div>
              {(navLinks ?? defaultNavLinks).map(link => <a key={link.href} href={link.href} style={asideLink}>{link.label}</a>)}
            </div>
            <div style={{ ...asideCard, marginTop: 14, background: 'linear-gradient(145deg, rgba(212,168,83,0.14), rgba(212,168,83,0.04))' }}>
              <Mail size={18} color="#D4A853" />
              <div style={{ marginTop: 13, fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>Questions?</div>
              <p style={{ margin: '7px 0 14px', color: 'rgba(240,237,231,0.58)', fontSize: 12.5, lineHeight: 1.6 }}>Our support team can help clarify how these documents apply to your account.</p>
              <a href="mailto:support@abrobiz.com" style={{ color: '#D4A853', fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }}>support@abrobiz.com</a>
            </div>
          </aside>
        </div>
      </main>

      <footer style={{ position: 'relative', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '24px', color: 'rgba(240,237,231,0.38)', fontSize: 12 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <span>© {new Date().getFullYear()} AbroBiz · Digital storefronts for growing businesses.</span>
          <span>Powered by AbroBiz</span>
        </div>
      </footer>
      <style>{`@media (max-width: 760px) { .legal-grid { grid-template-columns: 1fr !important; } .legal-aside { position: static !important; } .legal-nav { gap: 2px !important; } }`}</style>
    </div>
  )
}

const navStyle: React.CSSProperties = { color: 'rgba(240,237,231,0.62)', textDecoration: 'none', padding: '8px 10px', borderRadius: 8, fontSize: 13 }
const eyebrowStyle: React.CSSProperties = { color: '#D4A853', fontSize: 11, letterSpacing: 1.8, fontWeight: 700 }
const metaPill: React.CSSProperties = { border: '1px solid rgba(255,255,255,0.11)', background: 'rgba(255,255,255,0.04)', color: 'rgba(240,237,231,0.5)', padding: '7px 11px', borderRadius: 999, fontSize: 11.5 }
const asideCard: React.CSSProperties = { border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.035)', borderRadius: 16, padding: 18 }
const asideLabel: React.CSSProperties = { color: 'rgba(240,237,231,0.38)', textTransform: 'uppercase', letterSpacing: 1.1, fontSize: 10.5, fontWeight: 700, marginBottom: 12 }
const asideLink: React.CSSProperties = { display: 'block', color: 'rgba(240,237,231,0.65)', textDecoration: 'none', fontSize: 12.5, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }
const defaultNavLinks = [
  { href: '#accounts', label: 'Accounts & access' },
  { href: '#content', label: 'Business content' },
  { href: '#contact', label: 'Contact AbroBiz' },
]
