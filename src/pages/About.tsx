import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import PublicPageLayout from '../components/PublicPageLayout'

export default function About() {
  return (
    <PublicPageLayout title="The simple way to bring your business online." eyebrow="ABOUT ABROBIZ">
      <p>AbroBiz helps business owners launch a polished digital storefront without needing to build or maintain a website from scratch.</p>
      <p>After creating an account, an owner can add business details, branding, menus, products, services, opening hours, images, and customer-facing contact information. AbroBiz provides templates and settings so each business can shape its own public presence.</p>
      <p>Published businesses can receive a branded address such as <code style={codeStyle}>yourbusiness.abrobiz.com</code>. Depending on the plan and the business configuration, storefronts can also support customer enquiries, bookings, ordering, and reviews.</p>
      <h2 style={headingStyle}>What AbroBiz is for</h2>
      <ul style={listStyle}>
        <li>Independent restaurants, cafés, salons, shops, hotels, clinics, and other local businesses.</li>
        <li>Business owners who want a professional web presence and a shareable QR-ready storefront.</li>
        <li>Customers who need clear public information, menus, services, locations, and ways to contact a business.</li>
      </ul>
      <p>AbroBiz does not replace the business owner’s responsibility for the accuracy of information they publish or for how they respond to customer submissions.</p>
      <p><Link to="/privacy" style={linkStyle}>Read our Privacy Policy</Link> or <Link to="/contact" style={linkStyle}>contact AbroBiz support</Link> if you need more information.</p>
    </PublicPageLayout>
  )
}

const headingStyle: CSSProperties = { color: '#F0EDE7', fontFamily: 'Outfit, sans-serif', fontSize: 24, margin: '38px 0 12px' }
const listStyle: CSSProperties = { paddingLeft: 22, margin: '0 0 22px' }
const codeStyle: CSSProperties = { color: '#D4A853', fontFamily: 'ui-monospace, monospace', fontSize: '0.92em' }
const linkStyle: CSSProperties = { color: '#D4A853', textDecoration: 'none', fontWeight: 650 }
