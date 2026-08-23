import { brandedEmail } from '../_shared/emailLayout.ts'
import { escapeHtml, type EmailContent } from '../_shared/mailer.ts'

export function buildPasswordResetEmail(name: string, resetUrl: string, appName: string): EmailContent {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,'
  return brandedEmail({
    subject: `Reset your ${appName} password`,
    appName,
    preheader: 'A secure password reset link from AbroBiz.',
    title: 'Reset your password',
    greeting,
    bodyHtml: `<p style="margin:0;">We received a request to reset your ${appName} password. Choose a new password using the secure button below.</p>`,
    textBody: `We received a request to reset your ${appName} password. Choose a new password using the secure link below.`,
    action: { label: 'Reset my password', url: resetUrl },
    finePrint: "This link expires in 1 hour. If you did not request it, your password will not change.",
  })
}
