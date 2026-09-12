import LegalPageLayout from '../components/LegalPageLayout'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section id={id} style={{ marginBottom: 30, scrollMarginTop: 28 }}><h2 style={headingStyle}>{title}</h2>{children}</section>
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 10px' }}>{children}</p>
}

export default function Privacy() {
  return (
    <LegalPageLayout title="Privacy Policy" updated="September 2026" navLinks={privacyNavLinks}>
      <Paragraph>This Privacy Policy describes what AbroBiz collects, why we use it, and the choices available to account owners and visitors to AbroBiz-powered storefronts.</Paragraph>

      <Section id="accounts" title="1. Information you provide">
        <Paragraph>When you create or manage an account, we may collect your name, email address, phone number, login and verification details, business name, location, contact details, branding, catalog information, and plan or payment-submission information.</Paragraph>
        <Paragraph>When you contact support or connect an optional service such as Telegram, we also receive the information needed to respond and provide that connection.</Paragraph>
        <Paragraph>We may also create operational identifiers, such as an AbroBiz platform ID, and retain consent records showing which version of our legal documents you accepted and when.</Paragraph>
      </Section>

      <Section id="content" title="2. Information from storefront visitors">
        <Paragraph>Visitors may submit information through a business's contact, booking, order, or review forms. This can include a name, phone number, email address, order or booking details, message, and any information the visitor chooses to include.</Paragraph>
        <Paragraph>The business that operates the storefront is responsible for how it responds to these submissions and may have its own privacy notice.</Paragraph>
      </Section>

      <Section id="use" title="3. How we use information">
        <Paragraph>We use information to create and secure accounts, verify email addresses, provide storefront and dashboard features, process plan and payment workflows, deliver requested notifications, support customers, prevent abuse, troubleshoot incidents, and improve reliability and performance.</Paragraph>
        <Paragraph>We may use aggregated or de-identified information for analytics and service improvement. We do not sell personal information.</Paragraph>
      </Section>

      <Section id="sharing" title="4. Public information and service providers">
        <Paragraph>Business information intentionally published on a storefront—such as a business name, menu, catalog, opening hours, logo, gallery, and approved reviews—is public by design. Do not publish information that should remain private.</Paragraph>
        <Paragraph>We use trusted providers for hosting, authentication, database and storage infrastructure, email delivery, DNS or security, and optional integrations. They process information only as needed to provide their services, maintain security, or meet legal obligations.</Paragraph>
      </Section>

      <Section id="legal-basis" title="5. Why we are allowed to use information">
        <Paragraph>We use information to provide the service you request, perform our agreement with account owners, protect the platform and users from abuse, comply with legal obligations, and pursue legitimate operational interests such as reliability, support, and service improvement.</Paragraph>
        <Paragraph>Where a feature requires optional communications or an integration, we use the choices you make in the product. You can disconnect optional integrations from the relevant account controls.</Paragraph>
      </Section>

      <Section id="security" title="6. Security and retention">
        <Paragraph>We use access controls, authentication, row-level permissions, validation, rate limits, and monitoring appropriate to the service. No online service can guarantee absolute security, so protect your account and tell us about suspected misuse.</Paragraph>
        <Paragraph>We retain information while it is needed to provide the service, meet legal and accounting requirements, resolve disputes, enforce agreements, and protect the platform. Retention periods can vary by data type and context.</Paragraph>
      </Section>

      <Section id="cookies" title="7. Cookies and local storage">
        <Paragraph>AbroBiz uses essential browser storage for authentication, security, preferences, and core product functionality. We may use limited technical analytics or diagnostics to understand reliability. Your browser can restrict storage, but some features may stop working as a result.</Paragraph>
      </Section>

      <Section id="privacy-choices" title="8. Your choices and rights">
        <Paragraph>You can update much of your account and business information in the dashboard. You can also request access, correction, deletion, or clarification about personal information by contacting us. Depending on where you live, additional rights may apply.</Paragraph>
        <Paragraph>We may need to verify your identity before completing a request, and some information may need to be retained for security, legal, or operational reasons.</Paragraph>
      </Section>

      <Section id="children" title="9. Children">
        <Paragraph>AbroBiz is a business platform and is not directed to children. Please do not create an account or submit personal information if you are not legally able to use the service in your location.</Paragraph>
      </Section>

      <Section id="changes" title="10. Updates to this policy">
        <Paragraph>We may update this policy as the service or legal requirements change. The updated date will appear at the top of this page. Material changes may also be communicated through the product or by email.</Paragraph>
      </Section>

      <Section id="incidents" title="11. Security incidents">
        <Paragraph>If we discover a security incident that creates a legal obligation to notify affected people or authorities, we will follow the applicable notification requirements. We may also communicate practical steps you should take, such as changing a password or disconnecting an integration.</Paragraph>
      </Section>

      <Section id="transfers" title="12. Service locations and transfers">
        <Paragraph>AbroBiz and its providers may process information in countries other than the country where you live. We select providers with security and confidentiality commitments appropriate to the service and use safeguards required by applicable law.</Paragraph>
      </Section>

      <Section id="requests" title="13. Privacy requests">
        <Paragraph>To request access, correction, deletion, portability, or an explanation of how we use information, contact us from the account email where possible. We may verify the request, ask for clarification, and retain limited information when necessary for security, fraud prevention, legal compliance, or dispute resolution.</Paragraph>
      </Section>

      <Section id="contact" title="14. Contact AbroBiz">
        <Paragraph>For privacy questions or requests, email <a href="mailto:support@abrobiz.com" style={linkStyle}>support@abrobiz.com</a>. Include the account email and describe the request clearly so we can route it correctly.</Paragraph>
      </Section>
    </LegalPageLayout>
  )
}

const headingStyle: React.CSSProperties = { fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 650, color: '#F0EDE7', margin: '0 0 9px', letterSpacing: '-0.02em' }
const linkStyle: React.CSSProperties = { color: '#D4A853', textDecoration: 'none', fontWeight: 600 }
const privacyNavLinks = [
  { href: '#accounts', label: 'Information we collect' },
  { href: '#use', label: 'How we use it' },
  { href: '#sharing', label: 'Sharing & visibility' },
  { href: '#legal-basis', label: 'Why we use it' },
  { href: '#security', label: 'Security & retention' },
  { href: '#privacy-choices', label: 'Your choices' },
  { href: '#contact', label: 'Contact AbroBiz' },
]
