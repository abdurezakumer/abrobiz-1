import { brandedEmail } from '../_shared/emailLayout.ts'
import { escapeHtml, type EmailContent } from '../_shared/mailer.ts'

export function buildVerificationEmail(name: string, verifyUrl: string, appName: string): EmailContent {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,'
  return brandedEmail({
    subject: `Verify your ${appName} account`,
    appName,
    preheader: 'One quick step to finish creating your AbroBiz account.',
    title: 'Verify your email address',
    greeting,
    bodyHtml: '<p style="margin:0;">Thanks for choosing AbroBiz. Verify your email to finish setting up your business website.</p>',
    textBody: `Thanks for choosing ${appName}. Verify your email to finish setting up your business website.`,
    action: { label: 'Verify my email', url: verifyUrl },
    finePrint: 'This verification link expires in 24 hours.',
  })
}
