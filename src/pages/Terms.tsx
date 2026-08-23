import LegalPageLayout from '../components/LegalPageLayout'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 600, color: '#F0EDE7', marginBottom: 6 }}>{title}</h2>
      {children}
    </section>
  )
}

export default function Terms() {
  return (
    <LegalPageLayout title="Terms of Service" updated="August 2026">
      <Section title="1. Using the platform">
        <p>By creating an account, you agree to use this platform to represent your business honestly and to keep your account information accurate.</p>
      </Section>
      <Section title="2. Subscriptions and billing">
        <p>Plans are billed per the pricing shown at signup. Payment is reviewed manually before a subscription is activated or renewed; the platform is not responsible for delays caused by incomplete or unclear payment proof.</p>
      </Section>
      <Section title="3. Your content">
        <p>You're responsible for the accuracy of the menu, service, product, and business information you publish, and for having the rights to any images you upload.</p>
      </Section>
      <Section title="4. Customer-facing features">
        <p>Bookings, orders, and reviews submitted by your customers are requests only — you're responsible for confirming, fulfilling, and moderating them.</p>
      </Section>
      <Section title="5. Suspension">
        <p>Accounts may be suspended for fraudulent activity, abuse, or violation of these terms.</p>
      </Section>
      <Section title="6. Changes">
        <p>These terms may be updated from time to time; continued use of the platform after a change means you accept the update.</p>
      </Section>
      <Section title="7. Contact">
        <p>Questions about these terms can be sent through the Contact page of the business you're working with, or directly to the platform admin.</p>
      </Section>
    </LegalPageLayout>
  )
}
