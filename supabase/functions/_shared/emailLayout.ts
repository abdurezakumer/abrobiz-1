import { escapeHtml, type EmailContent } from './mailer.ts'

export interface BrandedEmailOptions {
  subject: string
  appName: string
  preheader: string
  title: string
  greeting: string
  bodyHtml: string
  textBody: string
  action?: { label: string; url: string }
  finePrint?: string
}

/** One consistent AbroBiz email shell for every transactional message. */
export function brandedEmail(options: BrandedEmailOptions): EmailContent {
  const appName = escapeHtml(options.appName || 'AbroBiz')
  const actionHtml = options.action
    ? `<a href="${escapeHtml(options.action.url)}" style="display:inline-block;background:#D4A853;color:#0A0C10;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px;">${escapeHtml(options.action.label)}</a>`
    : ''
  const finePrint = options.finePrint ?? 'If you did not request this message, you can safely ignore it.'

  const html = `
<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f1eb;color:#171717;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1eb;padding:28px 14px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e0d4;border-radius:18px;overflow:hidden;">
          <tr><td style="height:6px;background:#D4A853;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td style="padding:30px 34px 12px;">
            <table role="presentation" cellspacing="0" cellpadding="0"><tr>
              <td style="width:34px;height:34px;border-radius:10px;background:#0A0C10;color:#D4A853;font-size:17px;font-weight:800;line-height:34px;text-align:center;">A</td>
              <td style="padding-left:10px;color:#0A0C10;font-size:14px;font-weight:800;letter-spacing:2px;">${appName.toUpperCase()}</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:18px 34px 36px;">
            <p style="margin:0 0 18px;color:#8A6417;font-size:11px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;">${appName} account</p>
            <h1 style="margin:0 0 18px;color:#171717;font-size:27px;line-height:1.2;font-weight:750;">${escapeHtml(options.title)}</h1>
            <p style="margin:0 0 14px;color:#333;font-size:15px;line-height:1.7;">${options.greeting}</p>
            <div style="color:#444;font-size:15px;line-height:1.7;">${options.bodyHtml}</div>
            ${actionHtml ? `<div style="margin:28px 0 24px;">${actionHtml}</div>` : ''}
            <p style="margin:24px 0 0;color:#888;font-size:12.5px;line-height:1.6;">${escapeHtml(finePrint)}</p>
          </td></tr>
          <tr><td style="padding:18px 34px 28px;border-top:1px solid #eee8df;color:#999;font-size:11.5px;line-height:1.6;">
            <strong style="color:#555;">${appName}</strong> · Beautiful websites for ambitious businesses.<br />This is an automated message from AbroBiz.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim()

  const actionText = options.action ? `\n\n${options.action.label}: ${options.action.url}` : ''
  return {
    subject: options.subject,
    html,
    text: `${options.greeting}\n\n${options.textBody}${actionText}\n\n${finePrint}\n\n${options.appName} · AbroBiz`,
  }
}
