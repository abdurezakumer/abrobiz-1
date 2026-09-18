import PublicPageLayout from '../components/PublicPageLayout'
import type { CSSProperties } from 'react'

export default function Contact() {
  return (
    <PublicPageLayout title="We’re here to help you get live." eyebrow="CONTACT ABROBIZ">
      <p>For account, storefront, billing, privacy, or technical questions, email our support team. Tell us what happened, the page or feature involved, and the account email address where possible.</p>
      <p><a href="mailto:abdurezak4525@gmail.com" style={emailStyle}>abdurezak4525@gmail.com</a></p>
      <div style={cardStyle}>
        <h2 style={cardHeadingStyle}>Before you write</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Never send your password, one-time code, payment card details, or API keys.</li>
          <li>For privacy requests, use the email associated with your account where possible.</li>
          <li>For a storefront issue, include the public business address or a screenshot without private customer information.</li>
        </ul>
      </div>
      <p>We use the information in your message to investigate the request, respond, protect the platform, and keep a support record when necessary. See the <a href="/privacy" style={emailStyle}>Privacy Policy</a> for more.</p>
    </PublicPageLayout>
  )
}

const emailStyle: CSSProperties = { color: '#D4A853', textDecoration: 'none', fontWeight: 650 }
const cardStyle: CSSProperties = { margin: '30px 0', padding: '22px 24px', border: '1px solid rgba(212,168,83,0.24)', background: 'rgba(212,168,83,0.07)', borderRadius: 16 }
const cardHeadingStyle: CSSProperties = { color: '#F0EDE7', fontFamily: 'Outfit, sans-serif', fontSize: 20, margin: '0 0 10px' }
