export type TelegramProofMetadata = Record<string, unknown>

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

/**
 * Telegram captions are intentionally concise and safe to display in an
 * administrator-only archive channel. The complete structured record stays
 * in telegram_payment_proofs.metadata for queries and audit use.
 */
export function buildTelegramProofCaption(metadata: TelegramProofMetadata, paymentId?: string): string {
  const business = record(metadata.business)
  const owner = record(metadata.owner)
  const plan = record(metadata.plan)
  const payment = record(metadata.payment)
  const telegram = record(metadata.telegram)
  const archive = record(metadata.archive)
  const resolvedPaymentId = paymentId || text(payment.id)
  const planName = text(plan.name) || text(payment.plan_name)
  const methodName = text(payment.method_name)
  const lines = [
    'AbroBiz payment proof',
    `Reference: ${text(metadata.client_upload_id) || '—'}`,
    resolvedPaymentId ? `Payment ID: ${resolvedPaymentId}` : '',
    `Business: ${text(business.name) || 'Business'}`,
    text(business.slug) ? `Subdomain: ${text(business.slug)}.abrobiz.com` : '',
    `Owner: ${text(owner.name) || 'Owner'}`,
    text(owner.platform_id) ? `Platform ID: ${text(owner.platform_id)}` : '',
    text(owner.email) ? `Email: ${text(owner.email)}` : '',
    text(owner.phone) ? `Phone: ${text(owner.phone)}` : '',
    planName ? `Plan: ${planName}` : '',
    text(payment.billing_cycle) ? `Billing: ${text(payment.billing_cycle)}` : '',
    payment.amount_etb !== undefined ? `Amount: ${text(payment.amount_etb)} ETB` : '',
    methodName ? `Method: ${methodName}` : '',
    text(metadata.source) ? `Source: ${text(metadata.source)}` : '',
    text(telegram.chat_id) ? `Telegram chat: ${text(telegram.chat_id)}` : '',
    text(telegram.message_id) ? `User message: ${text(telegram.message_id)}` : '',
    text(archive.channel_id) ? `Archive channel: ${text(archive.channel_id)}` : '',
    text(archive.message_id) ? `Archive message: ${text(archive.message_id)}` : '',
    text(archive.metadata_message_id) ? `Metadata message: ${text(archive.metadata_message_id)}` : '',
  ].filter(Boolean)
  return lines.join('\n').slice(0, 1020)
}

/**
 * A photo caption cannot contain a complete structured audit record because
 * Telegram limits captions to 1024 characters. Keep the full JSON record in a
 * separate message in the private payment archive channel.
 */
export function buildTelegramProofMetadataMessage(metadata: TelegramProofMetadata): string {
  return `AbroBiz payment proof metadata\n${JSON.stringify(metadata, null, 2)}`.slice(0, 3900)
}
