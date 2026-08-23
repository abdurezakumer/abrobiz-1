import { escapeHtml, type EmailContent } from '../_shared/mailer.ts'

export function buildAnnouncementEmail(subject: string, body: string, appName: string): EmailContent {
  const paragraphs = body
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p style="margin: 0 0 14px; line-height: 1.6;">${escapeHtml(line)}</p>`)
    .join('')

  const html = `
<div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #161616;">
  <div style="width: 32px; height: 32px; border-radius: 8px; background: #D4A853; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #0A0C10; font-size: 16px; line-height: 32px; text-align: center; margin-bottom: 24px;">A</div>
  <h1 style="font-size: 19px; font-weight: 700; margin: 0 0 18px;">${escapeHtml(subject)}</h1>
  <div style="font-size: 14px; color: #333;">${paragraphs}</div>
  <p style="font-size: 12px; color: #aaa; margin-top: 28px;">You're receiving this because you have a business on ${escapeHtml(appName)}.</p>
</div>`.trim()

  const text = `${subject}\n\n${body}\n\n---\nYou're receiving this because you have a business on ${appName}.`

  return { subject, html, text }
}
