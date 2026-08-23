import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Clock, MapPin, Phone, Star } from 'lucide-react'

const dishes = [
  ['Doro Wat', 'Slow-simmered chicken in berbere sauce with spiced eggs', '320 ETB'],
  ['Beyaynetu', 'A colorful seven-way vegetarian platter on fresh injera', '220 ETB'],
  ['Ethiopian Coffee', 'Single-origin Yirgacheffe, roasted and brewed to order', '60 ETB'],
]

const gallery = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&h=650&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1519699788450-ad34386a3bfc?w=700&h=500&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1631166092772-d07aed54b9a0?w=700&h=500&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1639664342827-2d68822c55c9?w=700&h=700&fit=crop&auto=format',
]

export default function TemplateDemo() {
  const [menuTab, setMenuTab] = useState('Mains')
  const tabs = ['Starters', 'Mains', 'Desserts', 'Drinks']

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <a href="#home" style={brandStyle}><span style={brandMark}>A</span><span>Addis Table</span></a>
        <nav className="demo-nav" style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {['home', 'menu', 'about', 'gallery', 'contact'].map(section => <a key={section} href={`#${section}`} style={navLink}>{section[0].toUpperCase() + section.slice(1)}</a>)}
        </nav>
        <Link to="/register" style={demoCta}>Use this template</Link>
      </header>

      <main>
        <section id="home" style={heroStyle}>
          <div style={heroOverlay} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 850, margin: '0 auto', textAlign: 'center', padding: '120px 20px 110px' }}>
            <div style={eyebrow}><span style={{ width: 6, height: 6, borderRadius: 99, background: '#E8943A' }} /> Authentic Ethiopian Kitchen & Café</div>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ ...displayHeading, fontSize: 'clamp(50px, 10vw, 108px)', color: '#fff', margin: '25px 0 18px' }}>Addis Table</motion.h1>
            <p style={{ maxWidth: 600, margin: '0 auto', color: 'rgba(255,255,255,0.75)', fontSize: 17, lineHeight: 1.7 }}>Where every meal is a journey through the heart of Ethiopia — shared with warmth, spice, and belonging.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 32 }}>
              <a href="#menu" style={primaryButton}>Explore our menu <ArrowRight size={16} /></a>
              <a href="#gallery" style={secondaryButton}>View gallery</a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 34, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}><Star size={14} fill="#C17A38" color="#C17A38" /> 4.9 · 2,400+ reviews</div>
          </div>
        </section>

        <section style={{ padding: '78px 20px', maxWidth: 1120, margin: '0 auto' }}>
          <div style={centerHeading}><span style={eyebrowDark}>Our guests’ most-loved flavors</span><h2 style={displayHeading}>Popular dishes</h2></div>
          <div style={dishGrid}>{dishes.map(([name, desc, price], i) => <motion.article key={name} whileHover={{ y: -5 }} style={dishCard}><div style={{ height: 190, background: `url(${gallery[i]}) center/cover` }} /><div style={{ padding: 18 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><h3 style={{ ...displayHeading, fontSize: 20, margin: 0 }}>{name}</h3><strong style={{ color: '#C17A38', whiteSpace: 'nowrap', fontSize: 13 }}>{price}</strong></div><p style={{ color: 'rgba(44,26,14,0.58)', fontSize: 13, lineHeight: 1.6, margin: '8px 0 0' }}>{desc}</p></div></motion.article>)}</div>
        </section>

        <section id="menu" style={{ background: '#F4EDE3', padding: '82px 20px' }}>
          <div style={{ maxWidth: 850, margin: '0 auto' }}><div style={centerHeading}><span style={eyebrowDark}>Curated with tradition and love</span><h2 style={displayHeading}>Our menu</h2></div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', margin: '28px 0' }}>{tabs.map(tab => <button key={tab} onClick={() => setMenuTab(tab)} style={{ ...tabButton, background: menuTab === tab ? '#C17A38' : '#EAD9C8', color: menuTab === tab ? '#fff' : '#2C1A0E' }}>{tab}</button>)}</div>
            <div style={menuGrid}>{Array.from({ length: 6 }).map((_, i) => <div key={i} style={menuItem}><div><strong style={{ color: '#2C1A0E' }}>{menuTab} selection {i + 1}</strong><p style={{ color: 'rgba(44,26,14,0.55)', fontSize: 13, lineHeight: 1.5, margin: '5px 0 0' }}>Fresh ingredients, heritage spices and a generous table.</p></div><span style={{ color: '#C17A38', fontWeight: 700, fontSize: 13 }}>{120 + i * 35} ETB</span></div>)}</div>
          </div>
        </section>

        <section id="about" style={{ padding: '82px 20px', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}><span style={eyebrowDark}>Our story</span><h2 style={displayHeading}>A taste of home, shared with the world</h2><p style={bodyCopy}>Founded in the heart of Addis Ababa, this layout gives every restaurant, café and bakery a warm editorial story. Owners can replace this text, upload their own gallery, and change every menu item from their AbroBiz account.</p><div style={stats}><div><strong>14+</strong><span>Years of excellence</span></div><div><strong>60+</strong><span>Heritage dishes</span></div><div><strong>50K+</strong><span>Happy guests</span></div></div></section>

        <section id="gallery" style={{ background: '#F4EDE3', padding: '82px 20px' }}><div style={{ maxWidth: 1120, margin: '0 auto' }}><div style={centerHeading}><span style={eyebrowDark}>Moments, meals and memories</span><h2 style={displayHeading}>Gallery</h2></div><div style={galleryGrid}>{gallery.map((src, i) => <img key={src} src={src} alt="Restaurant demo" style={{ width: '100%', height: i === 0 ? 370 : 180, objectFit: 'cover', borderRadius: 16, gridRow: i === 0 ? 'span 2' : undefined }} />)}</div></div></section>

        <section id="contact" style={{ padding: '82px 20px', maxWidth: 900, margin: '0 auto' }}><div style={centerHeading}><span style={eyebrowDark}>We’re in the heart of the city</span><h2 style={displayHeading}>Find us</h2></div><div style={contactGrid}><div style={contactCard}><Clock size={19} color="#C17A38" /><div><strong>Opening hours</strong><p>Monday – Friday · 11:00 AM – 10:00 PM</p><p>Saturday – Sunday · 10:00 AM – 11:00 PM</p></div></div><div style={contactCard}><MapPin size={19} color="#C17A38" /><div><strong>42 Bole Road</strong><p>Addis Ababa, Ethiopia</p><a href="mailto:hello@abrobiz.com" style={{ color: '#C17A38' }}>hello@abrobiz.com</a></div></div><div style={contactCard}><Phone size={19} color="#C17A38" /><div><strong>Call us</strong><p>+251 911 234 567</p><a href="/register" style={{ color: '#C17A38' }}>Create your own site →</a></div></div></div></section>
      </main>
      <footer style={{ background: '#1A0E07', color: '#fff', padding: '26px 20px', textAlign: 'center', fontSize: 12, opacity: 0.95 }}>Powered by AbroBiz · Restaurant & Café Editorial demo</footer>
      <style>{`html { scroll-behavior: smooth; } @media (max-width: 760px) { .demo-nav { display: none !important; } }`}</style>
    </div>
  )
}

const pageStyle: React.CSSProperties = { background: '#FAF8F3', color: '#2C1A0E', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }
const headerStyle: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '13px 22px', background: 'rgba(250,248,243,0.94)', backdropFilter: 'blur(14px)', borderBottom: '1px solid #EAD9C8' }
const brandStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, color: '#2C1A0E', textDecoration: 'none', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600, fontSize: 16 }
const brandMark: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', background: '#C17A38', color: '#fff', fontFamily: 'Inter, sans-serif' }
const navLink: React.CSSProperties = { color: 'rgba(44,26,14,0.68)', textDecoration: 'none', padding: '7px 10px', borderRadius: 8, fontSize: 13 }
const demoCta: React.CSSProperties = { color: '#fff', background: '#1A0E07', textDecoration: 'none', padding: '9px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }
const heroStyle: React.CSSProperties = { position: 'relative', minHeight: 620, display: 'grid', placeItems: 'center', background: `url(${gallery[0]}) center/cover` }
const heroOverlay: React.CSSProperties = { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(26,14,7,0.68), rgba(26,14,7,0.38) 45%, rgba(26,14,7,0.88))' }
const eyebrow: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.84)', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' }
const eyebrowDark: React.CSSProperties = { color: '#C17A38', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }
const displayHeading: React.CSSProperties = { fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600, lineHeight: 1.1, margin: '10px 0', textTransform: 'capitalize' }
const centerHeading: React.CSSProperties = { textAlign: 'center', marginBottom: 34 }
const bodyCopy: React.CSSProperties = { maxWidth: 700, margin: '22px auto 0', color: 'rgba(44,26,14,0.62)', fontSize: 15, lineHeight: 1.8 }
const primaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#C17A38', color: '#fff', padding: '13px 20px', borderRadius: 999, textDecoration: 'none', fontSize: 13.5, fontWeight: 600 }
const secondaryButton: React.CSSProperties = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', padding: '12px 20px', borderRadius: 999, textDecoration: 'none', fontSize: 13.5 }
const dishGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }
const dishCard: React.CSSProperties = { background: '#FFFDF9', border: '1px solid #EAD9C8', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 24px rgba(44,26,14,0.06)' }
const tabButton: React.CSSProperties = { border: 'none', padding: '10px 18px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600 }
const menuGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }
const menuItem: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16, background: '#FFFDF9', border: '1px solid #EAD9C8', borderRadius: 12 }
const stats: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap: 55, flexWrap: 'wrap', marginTop: 38 }
const contactGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }
const contactCard: React.CSSProperties = { display: 'flex', gap: 12, padding: 18, background: '#FFFDF9', border: '1px solid #EAD9C8', borderRadius: 14, fontSize: 13 }
const galleryGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }
