import { escapeHtml, type EmailContent } from '../_shared/mailer.ts'
import { brandedEmail } from '../_shared/emailLayout.ts'

export function buildAnnouncementEmail(subject: string, body: string, appName: string): EmailContent {
  const paragraphs = body
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p style="margin: 0 0 14px; line-height: 1.6;">${escapeHtml(line)}</p>`)
    .join('')

  return brandedEmail({
    subject,
    appName,
    preheader: `A new announcement from ${appName}.`,
    title: subject,
    greeting: 'Hello from AbroBiz,',
    bodyHtml: paragraphs,
    textBody: body,
    finePrint: `You are receiving this because you have a business on ${appName}.`,
  })
}
