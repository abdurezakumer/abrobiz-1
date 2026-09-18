import { ArrowLeft, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'
import AbroBizLogo from './AbroBizLogo'

export default function PublicPageLayout({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#080A0E', color: '#F0EDE7', fontFamily: 'Inter, sans-serif' }}>
      <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 12% 0%, rgba(212,168,83,0.12), transparent 32%), radial-gradient(circle at 88% 20%, rgba(73,101,131,0.12), transparent 28%)' }} />
      <header style={{ position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,10,14,0.84)', backdropFilter: 'blur(16px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <Link to="/" style={{ textDecoration: 'none' }}><AbroBizLogo size={30} /></Link>
          <nav aria-label="Public navigation" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link to="/about" style={navStyle}>About</Link>
            <Link to="/contact" style={navStyle}>Contact</Link>
            <Link to="/privacy" style={navStyle}>Privacy</Link>
            <Link to="/terms" style={navStyle}>Terms</Link>
          </nav>
        </div>
      </header>
      <main style={{ position: 'relative', maxWidth: 900, margin: '0 auto', padding: '72px 24px 100px' }}>
        <div style={{ maxWidth: 760 }}>
          <div style={eyebrowStyle}>{eyebrow}</div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(38px, 7vw, 64px)', lineHeight: 1.02, letterSpacing: '-0.045em', margin: '14px 0 24px' }}>{title}</h1>
          <div style={{ color: 'rgba(240,237,231,0.72)', fontSize: 16, lineHeight: 1.85 }}>{children}</div>
        </div>
      </main>
      <footer style={{ position: 'relative', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '24px', color: 'rgba(240,237,231,0.42)', fontSize: 12 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}><ArrowLeft size={13} /> Back to AbroBiz</Link>
          <a href="mailto:abdurezak4525@gmail.com" style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}><Mail size={13} /> abdurezak4525@gmail.com</a>
          <span>Powered by AbroBiz</span>
        </div>
      </footer>
      <style>{`@media (max-width: 620px) { nav { flex-wrap: wrap; justify-content: flex-end; } }`}</style>
    </div>
  )
}

const navStyle: CSSProperties = { color: 'rgba(240,237,231,0.62)', textDecoration: 'none', padding: '8px 9px', borderRadius: 8, fontSize: 13 }
const eyebrowStyle: CSSProperties = { color: '#D4A853', fontSize: 11, letterSpacing: 1.8, fontWeight: 700 }
