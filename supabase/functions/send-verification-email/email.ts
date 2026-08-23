import { escapeHtml, type EmailContent } from '../_shared/mailer.ts'

export function buildVerificationEmail(name: string, verifyUrl: string, appName: string): EmailContent {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,'
  const subject = `Confirm your email for ${appName}`

  const html = `
<div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #161616;">
  <div style="width: 32px; height: 32px; border-radius: 8px; background: #D4A853; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #0A0C10; font-size: 16px; line-height: 32px; text-align: center; margin-bottom: 24px;">A</div>
  <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 16px;">Confirm your email</h1>
  <p style="font-size: 14.5px; line-height: 1.6; color: #444; margin: 0 0 24px;">${greeting} thanks for signing up for ${escapeHtml(appName)}. Please confirm this is your email address to finish setting up your account.</p>
  <a href="${verifyUrl}" style="display: inline-block; background: #D4A853; color: #0A0C10; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 10px;">Confirm my email</a>
  <p style="font-size: 12.5px; line-height: 1.6; color: #888; margin: 24px 0 0;">This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
  <p style="font-size: 12px; color: #aaa; margin-top: 24px; word-break: break-all;">Or paste this link into your browser: ${verifyUrl}</p>
</div>`.trim()

  const text = `${greeting}\n\nThanks for signing up for ${appName}. Confirm your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create this account, you can ignore this email.`

  return { subject, html, text }
}
