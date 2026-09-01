/**
 * Phase 9 staging recovery-test scaffold.
 *
 * This is a gate, not an automatic restore. It prevents accidental production
 * execution and records the checks an operator must complete in a disposable
 * staging project after selecting and restoring a verified backup.
 */
const baseUrl = process.env.PHASE9_DR_BASE_URL
const allow = process.env.PHASE9_DR_ALLOW
if (!baseUrl || allow !== 'staging') throw new Error('Set PHASE9_DR_BASE_URL and PHASE9_DR_ALLOW=staging.')

const target = new URL(baseUrl)
if (target.protocol !== 'https:') throw new Error('Recovery tests require HTTPS.')
if (target.hostname === 'abrobiz.com' || target.hostname.endsWith('.abrobiz.com') || target.hostname.endsWith('.supabase.co')) {
  throw new Error('Production and Supabase hosts are forbidden.')
}

const response = await fetch(new URL('/functions/v1/health?check=readiness', target), { redirect: 'error' })
const body = await response.text()
if (![200, 503].includes(response.status)) throw new Error(`Unexpected readiness status: ${response.status}`)
if (/(SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|TELEGRAM_BOT_TOKEN|password|token)/i.test(body)) throw new Error('Health response contains sensitive diagnostics.')

console.log(JSON.stringify({
  target_origin: target.origin,
  readiness_status: response.status,
  operator_checks: [
    'backup selected and checksum/export metadata recorded',
    'restore completed in disposable staging project',
    'all migrations are present and ordered',
    'RLS policies and service-role boundaries verified',
    'authentication, health, storefront, order, booking, payment, email, Telegram, and storage smoke tests passed',
    'data integrity counts and representative records reconciled',
  ],
}))
