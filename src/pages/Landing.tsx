import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { QrCode, Palette, Globe2, Check, ArrowRight, UserPlus, LayoutTemplate, Rocket, TrendingUp, Search, ArrowUpRight, Store, Sparkles } from 'lucide-react'
import { listPlans } from '../lib/api/plans'
import { listPublishedShowcaseBusinesses, type PublicShowcaseBusiness } from '../lib/api/businesses'
import { publicStorefrontUrl } from '../lib/storefrontUrl'
import { safeImageUrl } from '../lib/safeUrl'
import PhoneMockup from '../components/PhoneMockup'
import CategoryMarquee from '../components/CategoryMarquee'
import MagneticButton from '../components/MagneticButton'
import FaqAccordion from '../components/FaqAccordion'
import AbroBizLogo from '../components/AbroBizLogo'
import type { Plan } from '../types'

const ROTATING_WORDS = ['restaurants', 'cafés', 'salons', 'shops']

const FEATURES = [
  { icon: QrCode, title: 'Instant QR code', desc: 'Every business gets a scannable QR code linking straight to their live site.' },
  { icon: Palette, title: 'Beautiful templates', desc: 'Pick a look that fits your brand — modern, minimal, or warm & traditional.' },
  { icon: Globe2, title: 'Multi-language', desc: 'Reach more customers with English, Amharic, and Afaan Oromo support.' },
]

const STEPS = [
  { icon: UserPlus, title: 'Create your account', desc: 'Sign up and start a 7-day free trial — no card required.' },
  { icon: LayoutTemplate, title: 'Set up your site', desc: 'Pick your business type and a template, then add your menu, services, or products.' },
  { icon: Rocket, title: 'Go live', desc: 'Get your QR code and shareable link instantly — customers can find you right away.' },
  { icon: TrendingUp, title: 'Grow', desc: 'Upgrade to Premium anytime for bookings, online ordering, and customer reviews.' },
]

const FAQS = [
  { question: 'What kinds of businesses can use this?', answer: 'Restaurants, cafés, salons, retail shops, hotels, and more — the platform admin can add new business types anytime, so it keeps expanding.' },
  { question: 'Is there a free trial?', answer: 'Yes — 7 days, full access, no card required to start.' },
  { question: 'How does billing work?', answer: 'Payment is manual: you send payment via the methods shown at checkout (like Telebirr or bank transfer), upload your proof, and the platform admin reviews and approves it.' },
  { question: "Can I change my site's look later?", answer: 'Yes, anytime from your dashboard — template, colors, branding, and content are all editable whenever you like.' },
  { question: 'What languages are supported?', answer: 'English, Amharic, and Afaan Oromo out of the box, per business.' },
  { question: "What's included in Premium?", answer: 'Table/appointment/room bookings, online ordering with a cart and checkout, and customer reviews — all on top of everything in the base plans.' },
]

export default function Landing() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [showcase, setShowcase] = useState<PublicShowcaseBusiness[]>([])
  const [showcaseQuery, setShowcaseQuery] = useState('')
  const [showcaseCategory, setShowcaseCategory] = useState('All')
  const [showcaseLoading, setShowcaseLoading] = useState(true)
  const [showcaseError, setShowcaseError] = useState('')
  const [wordIndex, setWordIndex] = useState(0)

  useEffect(() => {
    listPlans().then(setPlans).catch(() => {})
    listPublishedShowcaseBusinesses().then(setShowcase).catch(() => setShowcaseError('Live storefronts are temporarily unavailable.')).finally(() => setShowcaseLoading(false))
  }, [])

  const showcaseCategories = ['All', ...Array.from(new Set(showcase.map(item => item.category))).sort()]
  const visibleShowcase = showcase.filter(item => {
    const matchesCategory = showcaseCategory === 'All' || item.category === showcaseCategory
    const term = showcaseQuery.trim().toLowerCase()
    return matchesCategory && (!term || `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(term))
  })

  useEffect(() => {
    const id = setInterval(() => setWordIndex(i => (i + 1) % ROTATING_WORDS.length), 2800)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ background: '#0A0C10', color: '#F0EDE7', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AbroBizLogo size={30} />
        </div>
        <nav style={{ display: 'flex', gap: 22, alignItems: 'center' }} className="landing-nav-links">
          <a href="#how-it-works" style={navLinkStyle}>How it works</a>
          <a href="#showcase" style={navLinkStyle}>Live businesses</a>
          <a href="#pricing" style={navLinkStyle}>Pricing</a>
          <a href="#faq" style={navLinkStyle}>FAQ</a>
        </nav>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Link to="/login" style={{ color: 'rgba(240,237,231,0.7)', textDecoration: 'none', fontSize: 14 }}>Log in</Link>
          <Link to="/register" style={{ background: '#D4A853', color: '#0A0C10', padding: '9px 18px', borderRadius: 9, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Get started
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div
        style={{
          maxWidth: 1100, margin: '0 auto', padding: '40px 24px 0',
          display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 40, alignItems: 'center',
        }}
        className="hero-grid"
      >
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(32px, 4.6vw, 50px)', fontWeight: 700, lineHeight: 1.12 }}
          >
            A beautiful digital
            <br />
            storefront for your{' '}
            <span style={{ position: 'relative', display: 'inline-grid' }}>
              <span style={{ visibility: 'hidden' }}>{ROTATING_WORDS.reduce((a, b) => (a.length > b.length ? a : b))}</span>
              <motion.span
                key={wordIndex}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.35 }}
                style={{ position: 'absolute', left: 0, top: 0, color: '#D4A853' }}
              >
                {ROTATING_WORDS[wordIndex]}
              </motion.span>
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}
            style={{ color: 'rgba(240,237,231,0.6)', fontSize: 16, marginTop: 20, lineHeight: 1.6, maxWidth: 460 }}
          >
            Go live with a QR-ready website, digital menu or catalog, and multi-language support in minutes — built for restaurants, cafés, salons, retail shops, and more.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }} style={{ marginTop: 28, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <MagneticButton>
              <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#D4A853', color: '#0A0C10', padding: '14px 28px', borderRadius: 12, fontSize: 15.5, fontWeight: 600, textDecoration: 'none' }}>
                Start your free trial <ArrowRight size={16} />
              </Link>
            </MagneticButton>
            <span style={{ fontSize: 12.5, color: 'rgba(240,237,231,0.4)' }}>7 days free, no card required</span>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }}
          style={{ display: 'flex', justifyContent: 'center' }}
        >
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 18, left: -68, zIndex: 2, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 12, padding: '9px 12px', backdropFilter: 'blur(12px)', boxShadow: '0 12px 35px rgba(0,0,0,0.2)' }} className="preview-badge">
              <div style={{ color: '#D4A853', fontSize: 9.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Live preview</div>
              <div style={{ color: 'rgba(240,237,231,0.68)', fontSize: 11.5, marginTop: 3 }}>Your brand, mobile-ready</div>
            </div>
            <PhoneMockup activeIndex={wordIndex} />
          </div>
        </motion.div>
      </div>

      <div style={{ marginTop: 48 }}>
        <CategoryMarquee />
      </div>

      <section id="showcase" style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 20px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <div style={showcaseEyebrow}><Sparkles size={13} /> LIVE ON ABROBIZ</div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 30, fontWeight: 650, margin: '10px 0 7px' }}>Explore businesses already live</h2>
            <p style={{ color: 'rgba(240,237,231,0.52)', fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 560 }}>Discover real AbroBiz storefronts and see how owners turn their menus, services, and products into polished digital experiences.</p>
          </div>
          <span style={showcaseCount}>{showcaseLoading ? 'Loading live storefronts…' : `${showcase.length} live storefront${showcase.length === 1 ? '' : 's'}`}</span>
        </div>
        {showcase.length > 0 && <>
          <div style={showcaseToolbar}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}><Search size={15} color="rgba(240,237,231,0.4)" style={{ position: 'absolute', left: 13, top: 12 }} /><input value={showcaseQuery} onChange={event => setShowcaseQuery(event.target.value)} placeholder="Search live businesses" style={showcaseInput} /></div>
            <select value={showcaseCategory} onChange={event => setShowcaseCategory(event.target.value)} style={showcaseSelect}>{showcaseCategories.map(category => <option key={category} value={category}>{category}</option>)}</select>
          </div>
          <div className="showcase-grid">{visibleShowcase.map((business, index) => <ShowcaseCard key={business.id} business={business} index={index} />)}</div>
          {visibleShowcase.length === 0 && <div style={showcaseEmpty}>No live storefronts match that search.</div>}
        </>}
        {!showcaseLoading && showcase.length === 0 && <div style={showcaseEmpty}>{showcaseError || 'Published storefronts will appear here as AbroBiz businesses go live.'}</div>}
      </section>

      {/* Features */}
      <div id="features" style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }}
            whileHover={{ y: -4 }}
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 24, transition: 'border-color 0.2s' }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(212,168,83,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <f.icon size={19} color="#D4A853" />
            </div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 600, marginTop: 14 }}>{f.title}</h3>
            <p style={{ fontSize: 13.5, color: 'rgba(240,237,231,0.5)', marginTop: 6, lineHeight: 1.6 }}>{f.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* How it works */}
      <div id="how-it-works" style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 20px' }}>
        <h2 style={{ textAlign: 'center', fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 600, marginBottom: 40 }}>How it works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, position: 'relative' }}>
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.1 }}
              style={{ textAlign: 'center' }}
            >
              <div style={{ position: 'relative', width: 52, height: 52, borderRadius: '50%', background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <step.icon size={22} color="#D4A853" />
                <span style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#D4A853', color: '#0A0C10', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {i + 1}
                </span>
              </div>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{step.title}</h3>
              <p style={{ fontSize: 13, color: 'rgba(240,237,231,0.5)', lineHeight: 1.6 }}>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      {plans.length > 0 && (
        <div id="pricing" style={{ maxWidth: 900, margin: '0 auto', padding: '20px 20px 80px' }}>
          <h2 style={{ textAlign: 'center', fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 600, marginBottom: 36 }}>Simple, transparent pricing</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {plans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }}
                whileHover={{ y: -5 }}
                style={{
                  background: i === 1 ? 'rgba(212,168,83,0.06)' : 'rgba(255,255,255,0.03)',
                  border: i === 1 ? '1.5px solid #D4A853' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18, padding: 26,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600 }}>{plan.name}</div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 32, fontWeight: 700, marginTop: 10 }}>
                  {plan.priceEtb} <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(240,237,231,0.45)' }}>ETB/{plan.billingInterval}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 22px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: 'rgba(240,237,231,0.65)' }}>
                      <Check size={15} color="#D4A853" style={{ flexShrink: 0, marginTop: 1 }} /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" style={{ display: 'block', textAlign: 'center', background: i === 1 ? '#D4A853' : 'rgba(255,255,255,0.06)', color: i === 1 ? '#0A0C10' : '#F0EDE7', padding: '11px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                  Get started
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ */}
      <div id="faq" style={{ maxWidth: 680, margin: '0 auto', padding: '20px 20px 80px' }}>
        <h2 style={{ textAlign: 'center', fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 600, marginBottom: 36 }}>Frequently asked questions</h2>
        <FaqAccordion items={FAQS} />
      </div>

      {/* Closing CTA */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 24px 90px', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 600, marginBottom: 12 }}>Ready to go live?</h2>
          <p style={{ color: 'rgba(240,237,231,0.5)', fontSize: 14.5, marginBottom: 24 }}>Set up your site in minutes. Cancel anytime during your trial.</p>
          <MagneticButton>
            <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#D4A853', color: '#0A0C10', padding: '13px 28px', borderRadius: 11, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
              Start your free trial <ArrowRight size={16} />
            </Link>
          </MagneticButton>
        </motion.div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '48px 24px 28px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 32 }} className="footer-grid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <AbroBizLogo size={26} />
            </div>
            <p style={{ fontSize: 12.5, color: 'rgba(240,237,231,0.4)', lineHeight: 1.6, maxWidth: 260 }}>
              A digital storefront platform for restaurants, cafés, salons, retail shops, and more.
            </p>
          </div>
          <div>
            <div style={footerHeading}>Product</div>
            <a href="#features" style={footerLink}>Features</a>
            <a href="#how-it-works" style={footerLink}>How it works</a>
            <a href="#pricing" style={footerLink}>Pricing</a>
          <a href="#faq" style={footerLink}>FAQ</a>
            <a href="#showcase" style={footerLink}>Live businesses</a>
          </div>
          <div>
            <div style={footerHeading}>Legal</div>
            <Link to="/terms" style={footerLink}>Terms of Service</Link>
            <Link to="/privacy" style={footerLink}>Privacy Policy</Link>
          </div>
        </div>
        <div style={{ maxWidth: 1000, margin: '32px auto 0', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', fontSize: 12, color: 'rgba(240,237,231,0.35)' }}>
          © {new Date().getFullYear()} AbroBiz. All rights reserved.
        </div>
      </footer>

      <style>{`
        @media (max-width: 820px) {
          .hero-grid { grid-template-columns: 1fr !important; text-align: center; }
          .hero-grid > div:first-child { display: flex; flex-direction: column; align-items: center; }
          .landing-nav-links { display: none !important; }
          .footer-grid { grid-template-columns: 1fr !important; text-align: center; }
          .preview-badge { display: none !important; }
          .showcase-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

const navLinkStyle: React.CSSProperties = { color: 'rgba(240,237,231,0.55)', textDecoration: 'none', fontSize: 13.5, fontWeight: 500 }
const footerHeading: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: 'rgba(240,237,231,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }
const footerLink: React.CSSProperties = { display: 'block', fontSize: 13, color: 'rgba(240,237,231,0.55)', textDecoration: 'none', marginBottom: 9 }
const showcaseEyebrow: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#D4A853', fontSize: 10.5, letterSpacing: 1.5, fontWeight: 700 }
const showcaseCount: React.CSSProperties = { color: 'rgba(240,237,231,0.5)', fontSize: 12, border: '1px solid rgba(255,255,255,0.11)', borderRadius: 999, padding: '7px 11px' }
const showcaseToolbar: React.CSSProperties = { display: 'flex', gap: 9, padding: 10, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, marginBottom: 16, flexWrap: 'wrap' }
const showcaseInput: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#F0EDE7', borderRadius: 10, padding: '10px 12px 10px 36px', outline: 'none', fontSize: 13, fontFamily: 'inherit' }
const showcaseSelect: React.CSSProperties = { background: '#171A20', border: '1px solid rgba(255,255,255,0.1)', color: '#F0EDE7', borderRadius: 10, padding: '10px 12px', outline: 'none', fontSize: 13, fontFamily: 'inherit' }
const showcaseEmpty: React.CSSProperties = { border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 16, padding: 28, color: 'rgba(240,237,231,0.45)', textAlign: 'center', fontSize: 13 }

function ShowcaseCard({ business, index }: { business: PublicShowcaseBusiness; index: number }) {
  const cover = safeImageUrl(business.coverUrl)
  const logo = safeImageUrl(business.logoUrl)
  return <motion.a href={publicStorefrontUrl(business.slug)} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .35, delay: Math.min(index * .04, .25) }} whileHover={{ y: -5 }} style={{ display: 'block', color: '#F0EDE7', textDecoration: 'none', background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 18, overflow: 'hidden' }}>
    <div style={{ height: 142, background: cover ? `linear-gradient(180deg, transparent, rgba(0,0,0,.58)), url("${cover}") center/cover` : `linear-gradient(135deg, ${business.accentColor}55, #171A20)` }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 12 }}><span style={{ background: 'rgba(10,12,16,.68)', backdropFilter: 'blur(8px)', borderRadius: 999, padding: '5px 8px', fontSize: 10, color: '#F0EDE7' }}>{business.category}</span><span style={{ width: 27, height: 27, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'rgba(10,12,16,.62)', color: '#D4A853' }}><ArrowUpRight size={14} /></span></div></div>
    <div style={{ padding: '14px 15px 16px', position: 'relative' }}>{logo ? <img src={logo} alt="" loading="lazy" style={{ position: 'absolute', width: 42, height: 42, objectFit: 'cover', borderRadius: 12, border: '3px solid #171A20', top: -24, right: 15, background: '#171A20' }} /> : <span style={{ position: 'absolute', width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 12, border: '3px solid #171A20', top: -24, right: 15, background: business.accentColor, color: '#0A0C10' }}><Store size={17} /></span>}<h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, margin: '0 48px 5px 0', fontWeight: 650 }}>{business.name}</h3><p style={{ color: 'rgba(240,237,231,0.5)', fontSize: 12.5, lineHeight: 1.55, margin: 0, minHeight: 38 }}>{business.description || `Visit ${business.name} on AbroBiz.`}</p><div style={{ color: business.accentColor, fontSize: 11.5, fontWeight: 650, marginTop: 11 }}>Visit storefront ↗</div></div>
  </motion.a>
}
