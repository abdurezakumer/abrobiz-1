import LegalPageLayout from '../components/LegalPageLayout'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section id={id} style={{ marginBottom: 30, scrollMarginTop: 28 }}><h2 style={headingStyle}>{title}</h2>{children}</section>
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 10px' }}>{children}</p>
}

export default function Terms() {
  return (
    <LegalPageLayout title="Terms of Service" updated="September 2026" navLinks={termsNavLinks}>
      <Paragraph>These Terms of Service explain the agreement between you and AbroBiz when you create an account, manage a business workspace, or publish a storefront through AbroBiz. By using the service, you agree to these terms.</Paragraph>

      <Section id="accounts" title="1. Accounts and access">
        <Paragraph>You must provide accurate information and keep your login details secure. Each account is intended for one business owner or authorized business operator, and access must not be sold, shared, or transferred without AbroBiz approval.</Paragraph>
        <Paragraph>You are responsible for activity performed through your account and should contact AbroBiz promptly if you believe your account has been accessed without permission.</Paragraph>
        <Paragraph>Your AbroBiz platform ID is a support and accountability identifier. It is not a password, payment credential, or permission to access another account. Administrator access is assigned by an authorized super administrator and may be limited by role.</Paragraph>
      </Section>

      <Section id="content" title="2. Your business content">
        <Paragraph>You retain responsibility for the text, prices, menus, images, logos, offers, and other materials you upload. You confirm that you have the rights and permissions needed to use that content and that it is accurate for your customers.</Paragraph>
        <Paragraph>You give AbroBiz permission to host, reproduce, and display your content only as needed to operate, secure, support, and improve the service. You may update or remove your content through your account, subject to reasonable backups and retention obligations.</Paragraph>
      </Section>

      <Section id="customer-use" title="3. Customer-facing features">
        <Paragraph>Bookings, orders, contact messages, and reviews are interactions between a business and its customers. AbroBiz provides the tools but does not guarantee that a customer will attend, pay, place an order, or leave an accurate review.</Paragraph>
        <Paragraph>Businesses are responsible for confirming requests, fulfilling orders, responding to customers, and complying with the laws and operational requirements that apply to their business.</Paragraph>
      </Section>

      <Section id="payments" title="4. Plans, trials, and payments">
        <Paragraph>Plan prices, included features, trial periods, and billing intervals are shown in the product or on the AbroBiz website. The current standard free trial is seven calendar days unless a specific written promotion says otherwise. A manual payment submission is not an activation guarantee; a plan becomes active after AbroBiz reviews and approves the payment.</Paragraph>
        <Paragraph>Payment evidence must be genuine, legible, and related to the account submitting it. AbroBiz may reject or request clarification for incomplete, duplicate, or suspicious submissions.</Paragraph>
        <Paragraph>Prices are shown in the displayed currency and may change for future billing periods. Unless a written offer says otherwise, subscriptions do not automatically renew through a stored card. You are responsible for submitting renewal payment before the current access period ends.</Paragraph>
      </Section>

      <Section id="acceptable-use" title="5. Acceptable use">
        <Paragraph>You may not use AbroBiz to break the law, impersonate another person or business, distribute malware, upload harmful or infringing material, send spam, scrape private data, evade security controls, or interfere with the service.</Paragraph>
        <Paragraph>AbroBiz may remove content or restrict an account when necessary to protect customers, businesses, the platform, or third parties.</Paragraph>
      </Section>

      <Section id="availability" title="6. Service availability and third parties">
        <Paragraph>We work to keep AbroBiz reliable, but the service may occasionally be unavailable for maintenance, security response, provider outages, or events outside our control. Features that rely on email, hosting, storage, DNS, payment networks, or other providers may also be affected by those providers.</Paragraph>
      </Section>

      <Section id="termination" title="7. Suspension and termination">
        <Paragraph>You may stop using your account at any time. AbroBiz may suspend or terminate access for serious or repeated violations, fraud, abuse, non-payment, security risk, or legal obligation. Where practical, we will provide notice and an opportunity to resolve the issue.</Paragraph>
      </Section>

      <Section id="intellectual-property" title="8. Intellectual property">
        <Paragraph>AbroBiz, its name, brand elements, software, interface, documentation, and platform technology are owned by AbroBiz or its licensors. These Terms give you a limited, non-exclusive, non-transferable right to use the service while your account is in good standing.</Paragraph>
        <Paragraph>You may not copy, resell, reverse engineer, scrape, frame, or commercially exploit the platform except where applicable law expressly permits it or AbroBiz gives written permission.</Paragraph>
      </Section>

      <Section id="integrations" title="9. Integrations and communications">
        <Paragraph>Email, Telegram, hosting, DNS, storage, payment networks, and other integrations are optional service components. If you connect one, you authorize AbroBiz to send the account-related messages needed for the feature and understand that the provider's own terms may also apply.</Paragraph>
        <Paragraph>Only one Telegram connection may be active for an AbroBiz account at a time. You can disconnect it from your account controls and should disconnect it immediately if the Telegram account is no longer under your control.</Paragraph>
      </Section>

      <Section id="disclaimers" title="10. Disclaimers and liability">
        <Paragraph>AbroBiz is provided on an availability basis. To the extent permitted by applicable law, we do not promise that the service will be uninterrupted, error-free, or suitable for every business need. You remain responsible for maintaining copies of important business information.</Paragraph>
        <Paragraph>Nothing in these terms excludes rights or remedies that cannot legally be excluded. Any liability limitations will apply only to the extent permitted by applicable law.</Paragraph>
      </Section>

      <Section id="changes" title="11. Changes to these terms">
        <Paragraph>We may update these terms when the service, law, or business practices change. We will update the date above and, where appropriate, provide notice through the product or by email. Continued use after an update means you accept the revised terms.</Paragraph>
      </Section>

      <Section id="general" title="12. General terms">
        <Paragraph>If part of these Terms is found unenforceable, the remaining sections continue to apply. A delay in enforcing a provision is not a waiver of that provision. These Terms and any product-specific notice form the agreement for your use of AbroBiz.</Paragraph>
        <Paragraph>Nothing here creates an employment, agency, partnership, or joint-venture relationship between you and AbroBiz. You may not assign this agreement without our written consent.</Paragraph>
      </Section>

      <Section id="contact" title="13. Contact AbroBiz">
        <Paragraph>If you have a question about these terms, contact <a href="mailto:support@abrobiz.com" style={linkStyle}>support@abrobiz.com</a>. Please include the account email and enough context for us to help.</Paragraph>
      </Section>
    </LegalPageLayout>
  )
}

const headingStyle: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 650, color: '#F0EDE7', margin: '0 0 9px', letterSpacing: '-0.02em' }
const linkStyle: React.CSSProperties = { color: '#D4A853', textDecoration: 'none', fontWeight: 600 }
const termsNavLinks = [
  { href: '#accounts', label: 'Accounts & access' },
  { href: '#content', label: 'Business content' },
  { href: '#payments', label: 'Plans & payments' },
  { href: '#acceptable-use', label: 'Acceptable use' },
  { href: '#integrations', label: 'Integrations' },
  { href: '#general', label: 'General terms' },
  { href: '#contact', label: 'Contact AbroBiz' },
]
