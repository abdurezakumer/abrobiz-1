import LegalPageLayout from '../components/LegalPageLayout'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 600, color: '#F0EDE7', marginBottom: 6 }}>{title}</h2>
      {children}
    </section>
  )
}

export default function Privacy() {
  return (
    <LegalPageLayout title="Privacy Policy" updated="August 2026">
      <Section title="1. What we collect">
        <p>Account details you provide (name, phone, email), business information you publish, and information customers submit through your site's contact, booking, order, or review forms.</p>
      </Section>
      <Section title="2. How it's used">
        <p>To operate your account and storefront, process subscription payments, send account and order-related notifications (including via email and Telegram, if connected), and improve the platform.</p>
      </Section>
      <Section title="3. Payment proof">
        <p>Screenshots or receipts uploaded for subscription payments are visible only to you and the platform admin, and are used solely to verify payment.</p>
      </Section>
      <Section title="4. Sharing">
        <p>Customer-facing information you publish (business details, catalog, approved reviews) is public by design. We don't sell personal data to third parties.</p>
      </Section>
      <Section title="5. Your choices">
        <p>You can edit or remove most of your business's information at any time from your dashboard, and can request account deletion by contacting the platform admin.</p>
      </Section>
      <Section title="6. Contact">
        <p>Questions about this policy can be directed to the platform admin.</p>
      </Section>
    </LegalPageLayout>
  )
}
