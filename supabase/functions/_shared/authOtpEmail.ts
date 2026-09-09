import { brandedEmail } from './emailLayout.ts'
import { escapeHtml, sendEmail, createSmtpSenderFromEnv, type SendResult } from './mailer.ts'

export async function sendAuthOtpEmail({
  email,
  code,
  name,
  purpose,
}: {
  email: string
  code: string
  name?: string
  purpose: 'signup' | 'login'
}): Promise<SendResult> {
  const appName = Deno.env.get('APP_NAME') ?? 'AbroBiz'
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,'
  const purposeText = purpose === 'signup' ? 'finish creating your AbroBiz account' : 'sign in to your AbroBiz account'
  const content = brandedEmail({
    subject: `${code} is your AbroBiz verification code`,
    appName,
    preheader: `Your AbroBiz verification code is ${code}.`,
    title: 'Your verification code',
    greeting,
    bodyHtml: `<p style="margin:0 0 18px;">Use the code below to ${purposeText}. It expires shortly and can only be used once.</p><div style="display:inline-block;background:#f8f3e9;border:1px solid #ead9b9;border-radius:14px;padding:16px 22px;color:#171717;font-size:32px;font-weight:800;letter-spacing:9px;line-height:1;">${escapeHtml(code)}</div>`,
    textBody: `Use this code to ${purposeText}: ${code}. It expires shortly and can only be used once.`,
    finePrint: 'If you did not request this code, you can safely ignore this email.',
  })

  try {
    // Signup and resend OTPs must use the configured SMTP account. Do not
    // silently switch to Resend (or another provider) when both are present.
    const sender = createSmtpSenderFromEnv(Deno.env)
    return await sendEmail(sender.sendMail, { from: sender.from, to: email, content })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
