// Supabase's current Edge SMTP example uses the Nodemailer 9.x line. Keep the
// dependency pinned so the function does not change behavior between deploys.
import nodemailer from 'npm:nodemailer@9.1.1'
import { fetchWithTimeout, readJsonResponse } from './external.ts'

export interface EmailContent {
  subject: string
  html: string
  text: string
}

export interface SendResult {
  ok: boolean
  id?: string
  error?: string
}

export interface SendMailFn {
  (msg: { from: string; to: string; subject: string; html: string; text: string }): Promise<{ messageId?: string }>
}

/** Domain email via Resend — the recommended path once you own a real domain. */
export function createResendSender(apiKey: string): SendMailFn {
  return async msg => {
    const res = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    })
    const data = await readJsonResponse(res, 64 * 1024).catch(() => ({}))
    if (!res.ok) throw new Error(data?.message ?? `Resend API error (${res.status})`)
    return { messageId: data?.id }
  }
}

/** Gmail SMTP fallback — works with just a personal Gmail account, capped around 500 sends/day. */
export function createGmailSender(gmailUser: string, appPassword: string): SendMailFn {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: appPassword },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  })
  return msg => transporter.sendMail(msg)
}

/** Generic SMTP sender. This is the shape used by the platform's deployment
 * secrets, so it works with Gmail now and can be moved to another SMTP host
 * later without changing any email function. */
export function createSmtpSender(opts: {
  server: string
  port: number
  username: string
  password: string
  useTls: boolean
}): SendMailFn {
  const password = /(^|\.)gmail\.com$/i.test(opts.server) ? opts.password.replace(/\s+/g, '') : opts.password
  const transporter = nodemailer.createTransport({
    host: opts.server,
    port: opts.port,
    secure: opts.port === 465,
    requireTLS: opts.useTls && opts.port !== 465,
    auth: { user: opts.username, pass: password },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  })
  return msg => transporter.sendMail(msg)
}

function envBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  return /^(1|true|yes|on)$/i.test(value)
}

/**
 * Builds the visible From header.
 * - Explicit EMAIL_FROM always wins.
 * - Otherwise, a configured domain gets `noreply@yourdomain.com`.
 * - Otherwise, a Gmail account gets plus-addressed (`user+noreply@gmail.com`)
 *   so it reads as no-reply while still landing in that same inbox.
 */
export function buildFromAddress(appName: string, opts: { override?: string; domain?: string; gmailUser?: string }): string {
  if (opts.override) return opts.override
  if (opts.domain) return `"${appName}" <noreply@${opts.domain}>`
  if (opts.gmailUser) {
    const atIndex = opts.gmailUser.indexOf('@')
    if (atIndex === -1) return `"${appName}" <${opts.gmailUser}>`
    const [local, domain] = [opts.gmailUser.slice(0, atIndex), opts.gmailUser.slice(atIndex + 1)]
    const noreplyLocal = local.includes('+') ? local : `${local}+noreply`
    return `"${appName}" <${noreplyLocal}@${domain}>`
  }
  return `"${appName}" <noreply@example.com>`
}

function smtpFromAddress(appName: string, username: string, override: string | undefined, domain: string | undefined): string {
  // Gmail SMTP may reject a From address that is not the authenticated Gmail
  // account (unless it has been explicitly configured as a verified alias).
  // Keep the AbroBiz display name, but use the authenticated address as the
  // safe default for personal Gmail accounts.
  if (/@gmail\.com$/i.test(username)) {
    const configuredAddress = override?.match(/<\s*([^>\s]+)\s*>/)?.[1] ?? override?.trim()
    if (!configuredAddress || configuredAddress.toLowerCase() !== username.toLowerCase()) {
      return buildFromAddress(appName, { gmailUser: username })
    }
  }
  return buildFromAddress(appName, { override, domain, gmailUser: username })
}

/** Builds the explicitly configured MAIL_* SMTP sender.
 *
 * This is intentionally separate from createSenderFromEnv so authentication
 * messages can require SMTP and never silently fall back to another provider.
 */
export function createSmtpSenderFromEnv(env: { get(key: string): string | undefined }): { sendMail: SendMailFn; from: string } {
  const appName = env.get('APP_NAME') ?? 'AbroBiz'
  const mailServer = env.get('MAIL_SERVER')
  const mailUsername = env.get('MAIL_USERNAME')
  const mailPassword = env.get('MAIL_PASSWORD')

  if (!mailServer || !mailUsername || !mailPassword) {
    throw new Error('SMTP email is not configured — set MAIL_SERVER, MAIL_PORT, MAIL_USERNAME, and MAIL_PASSWORD')
  }

  const mailPort = Number(env.get('MAIL_PORT') ?? '587')
  return {
    sendMail: createSmtpSender({
      server: mailServer,
      port: Number.isFinite(mailPort) && mailPort > 0 ? mailPort : 587,
      username: mailUsername,
      password: mailPassword,
      useTls: envBoolean(env.get('MAIL_USE_TLS'), true),
    }),
    from: smtpFromAddress(
      appName,
      mailUsername,
      env.get('MAIL_FROM') ?? env.get('EMAIL_FROM') ?? undefined,
      env.get('EMAIL_DOMAIN') ?? undefined,
    ),
  }
}

/** Picks Resend, then generic MAIL_* SMTP, then legacy Gmail vars automatically. */
export function createSenderFromEnv(env: { get(key: string): string | undefined }): { sendMail: SendMailFn; from: string } {
  const appName = env.get('APP_NAME') ?? 'AbroBiz'
  const override = env.get('EMAIL_FROM') ?? env.get('MAIL_FROM') ?? undefined
  const resendKey = env.get('RESEND_API_KEY')
  const domain = env.get('EMAIL_DOMAIN') ?? undefined

  if (resendKey) {
    return { sendMail: createResendSender(resendKey), from: buildFromAddress(appName, { override, domain }) }
  }

  const mailServer = env.get('MAIL_SERVER')
  const mailPort = Number(env.get('MAIL_PORT') ?? '587')
  const mailUsername = env.get('MAIL_USERNAME')
  const mailPassword = env.get('MAIL_PASSWORD')
  if (mailServer && mailUsername && mailPassword) {
    return {
      sendMail: createSmtpSender({
        server: mailServer,
        port: Number.isFinite(mailPort) ? mailPort : 587,
        username: mailUsername,
        password: mailPassword,
        useTls: envBoolean(env.get('MAIL_USE_TLS'), true),
      }),
      from: buildFromAddress(appName, { override, domain, gmailUser: mailUsername }),
    }
  }

  const gmailUser = env.get('GMAIL_USER')
  const gmailAppPassword = env.get('GMAIL_APP_PASSWORD')
  if (gmailUser && gmailAppPassword) {
    return { sendMail: createGmailSender(gmailUser, gmailAppPassword), from: buildFromAddress(appName, { override, gmailUser }) }
  }

  throw new Error('No email provider configured — set RESEND_API_KEY (+ EMAIL_DOMAIN), MAIL_SERVER + MAIL_USERNAME + MAIL_PASSWORD, or GMAIL_USER + GMAIL_APP_PASSWORD')
}

export async function sendEmail(sendMail: SendMailFn, opts: { from: string; to: string; content: EmailContent }): Promise<SendResult> {
  try {
    const info = await sendMail({ from: opts.from, to: opts.to, subject: opts.content.subject, html: opts.content.html, text: opts.content.text })
    return { ok: true, id: info.messageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
