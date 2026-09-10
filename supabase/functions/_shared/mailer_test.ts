import assert from 'node:assert/strict'
import { buildFromAddress, sendEmail, createSenderFromEnv, createSmtpSenderFromEnv, type SendMailFn } from './mailer.ts'
import { buildVerificationEmail } from '../send-verification-email/email.ts'

function assertOk(cond: boolean, msg: string) {
  assert.ok(cond, msg)
}

function fakeEnv(vars: Record<string, string>) {
  return { get: (key: string) => vars[key] }
}

Deno.test('buildFromAddress prefers a real domain over Gmail plus-addressing once one is configured', () => {
  const from = buildFromAddress('AbroBiz', { domain: 'abrobiz.com' })
  assert.equal(from, '"AbroBiz" <noreply@abrobiz.com>')
})

Deno.test('buildFromAddress falls back to Gmail plus-addressing with no domain configured', () => {
  const from = buildFromAddress('AbroBiz', { gmailUser: 'oneabdre@gmail.com' })
  assert.equal(from, '"AbroBiz" <oneabdre+noreply@gmail.com>')
})

Deno.test('buildFromAddress: an explicit override always wins over domain or Gmail defaults', () => {
  const from = buildFromAddress('AbroBiz', { override: 'Abdre <oneabdre@gmail.com>', domain: 'abrobiz.com', gmailUser: 'oneabdre@gmail.com' })
  assert.equal(from, 'Abdre <oneabdre@gmail.com>')
})

Deno.test('createSenderFromEnv picks Resend when RESEND_API_KEY is set, even if Gmail vars are also present', () => {
  const env = fakeEnv({
    RESEND_API_KEY: 're_test', EMAIL_DOMAIN: 'abrobiz.com', APP_NAME: 'AbroBiz',
    GMAIL_USER: 'oneabdre@gmail.com', GMAIL_APP_PASSWORD: 'app-pw',
  })
  const sender = createSenderFromEnv(env)
  assert.equal(sender.from, '"AbroBiz" <noreply@abrobiz.com>')
})

Deno.test('createSenderFromEnv falls back to Gmail when no Resend key is set', () => {
  const env = fakeEnv({ APP_NAME: 'AbroBiz', GMAIL_USER: 'oneabdre@gmail.com', GMAIL_APP_PASSWORD: 'app-pw' })
  const sender = createSenderFromEnv(env)
  assert.equal(sender.from, '"AbroBiz" <oneabdre+noreply@gmail.com>')
})

Deno.test('createSenderFromEnv accepts the MAIL_* SMTP settings', () => {
  const env = fakeEnv({
    APP_NAME: 'AbroBiz', MAIL_SERVER: 'smtp.gmail.com', MAIL_PORT: '587',
    MAIL_USERNAME: 'oneabdre@gmail.com', MAIL_PASSWORD: 'app-pw', MAIL_USE_TLS: 'true',
    MAIL_FROM: 'Abdre <oneabdre@gmail.com>',
  })
  const sender = createSenderFromEnv(env)
  assert.equal(sender.from, 'Abdre <oneabdre@gmail.com>')
})

Deno.test('createSmtpSenderFromEnv requires MAIL_* SMTP even when Resend is configured', () => {
  const env = fakeEnv({
    APP_NAME: 'AbroBiz', RESEND_API_KEY: 're_test', EMAIL_DOMAIN: 'abrobiz.com',
    MAIL_SERVER: 'smtp.gmail.com', MAIL_PORT: '587', MAIL_USERNAME: 'oneabdre@gmail.com',
    MAIL_PASSWORD: 'app-pw', MAIL_USE_TLS: 'true', MAIL_FROM: 'AbroBiz <oneabdre@gmail.com>',
  })
  const sender = createSmtpSenderFromEnv(env)
  assert.equal(sender.from, 'AbroBiz <oneabdre@gmail.com>')
})

Deno.test('createSmtpSenderFromEnv fails clearly when SMTP is missing', () => {
  const env = fakeEnv({ RESEND_API_KEY: 're_test', EMAIL_DOMAIN: 'abrobiz.com' })
  assert.throws(() => createSmtpSenderFromEnv(env), /SMTP email is not configured/)
})

Deno.test('createSmtpSenderFromEnv uses the authenticated Gmail address when MAIL_FROM is not a verified Gmail address', () => {
  const env = fakeEnv({
    APP_NAME: 'AbroBiz', MAIL_SERVER: 'smtp.gmail.com', MAIL_PORT: '465', MAIL_USERNAME: 'oneabdre@gmail.com',
    MAIL_PASSWORD: 'app-pw', MAIL_USE_TLS: 'true', MAIL_FROM: 'AbroBiz <noreply@abrobiz.com>',
  })
  const sender = createSmtpSenderFromEnv(env)
  assert.equal(sender.from, '"AbroBiz" <oneabdre+noreply@gmail.com>')
})

Deno.test('createSenderFromEnv throws a clear error when nothing is configured, instead of failing mysteriously later', () => {
  const env = fakeEnv({})
  assert.throws(() => createSenderFromEnv(env), /No email provider configured/)
})

Deno.test('buildVerificationEmail includes the verify link in both html and text', () => {
  const content = buildVerificationEmail('Abebe', 'https://example.com/verify-email?token=abc123', 'AbroBiz')
  assertOk(content.html.includes('https://example.com/verify-email?token=abc123'), 'html should contain the link')
  assertOk(content.text.includes('https://example.com/verify-email?token=abc123'), 'text should contain the link')
})

Deno.test('buildVerificationEmail escapes HTML in the name (never inject unescaped user input)', () => {
  const content = buildVerificationEmail('<script>alert(1)</script>', 'https://x.test/v?token=t', 'App')
  assertOk(!content.html.includes('<script>alert(1)</script>'), 'raw script tag must not appear unescaped')
  assertOk(content.html.includes('&lt;script&gt;'), 'should be HTML-escaped instead')
})

Deno.test('sendEmail calls the injected sender with the right message shape', async () => {
  let captured: any = null
  const fakeSend: SendMailFn = async msg => {
    captured = msg
    return { messageId: 'msg_123' }
  }

  const result = await sendEmail(fakeSend, {
    from: '"App" <noreply@abrobiz.com>',
    to: 'user@example.com',
    content: { subject: 'Subject', html: '<p>hi</p>', text: 'hi' },
  })

  assert.equal(result.ok, true)
  assert.equal(result.id, 'msg_123')
  assert.equal(captured.from, '"App" <noreply@abrobiz.com>')
  assert.equal(captured.to, 'user@example.com')
})

Deno.test('sendEmail surfaces an error instead of throwing when the send fails', async () => {
  const failingSend: SendMailFn = async () => {
    throw new Error('Invalid login: 535-5.7.8 Username and Password not accepted')
  }
  const result = await sendEmail(failingSend, { from: 'a@abrobiz.com', to: 'user@example.com', content: { subject: 's', html: 'h', text: 't' } })
  assert.equal(result.ok, false)
  assertOk(result.error!.includes('Username and Password not accepted'), 'should surface the underlying error')
})

Deno.test('buildPasswordResetEmail includes the reset link and escapes the name', async () => {
  const { buildPasswordResetEmail } = await import('../request-password-reset/email.ts')
  const content = buildPasswordResetEmail('<b>Abebe</b>', 'https://abrobiz.com/reset-password?token=xyz', 'AbroBiz')
  assertOk(content.html.includes('https://abrobiz.com/reset-password?token=xyz'), 'html should contain the reset link')
  assertOk(content.text.includes('https://abrobiz.com/reset-password?token=xyz'), 'text should contain the reset link')
  assertOk(!content.html.includes('<b>Abebe</b>'), 'raw HTML in the name must not appear unescaped')
})

Deno.test('buildAnnouncementEmail splits the body into paragraphs and escapes content', async () => {
  const { buildAnnouncementEmail } = await import('../send-announcement/email.ts')
  const content = buildAnnouncementEmail('New feature!', 'Line one.\nLine two with <script>bad</script>.', 'AbroBiz')
  assertOk(content.html.includes('Line one.'), 'should include first paragraph')
  assertOk(content.html.includes('Line two with'), 'should include second paragraph')
  assertOk(!content.html.includes('<script>bad</script>'), 'must escape injected HTML in the body')
  assertOk(content.text.includes('Line one.') && content.text.includes('Line two'), 'text version should include both lines')
})
