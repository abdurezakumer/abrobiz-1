import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (file: string) => readFileSync(resolve(root, file), 'utf8')
function readSourceTree(directory: string): string {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).map(entry => {
    const path = `${directory}/${entry.name}`
    return entry.isDirectory() ? readSourceTree(path) : !entry.name.endsWith('.test.ts') && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) ? read(path) : ''
  }).join('\n')
}

describe('production security remediation invariants', () => {
  it('does not return signup account identifiers or OTP shape', () => {
    const source = read('supabase/functions/signup/index.ts')
    expect(source).not.toMatch(/otpLength/)
    expect(source).not.toMatch(/return json\(\{\.\.\.GENERIC_RESPONSE[\s\S]*user\s*\}/)
  })

  it('requires explicit permission checks for managed storage', () => {
    const upload = read('supabase/functions/storage-upload/index.ts')
    const signed = read('supabase/functions/storage-signed-url/index.ts')
    expect(upload).toMatch(/has_admin_permission/)
    expect(upload).not.toMatch(/isAdmin\s*=/)
    expect(signed).toMatch(/payments\.read/)
    expect(signed).toMatch(/owner_id/)
  })

  it('contains the final MFA and tenant policy controls', () => {
    const migration = read('supabase/migrations/0050_full_security_remediation.sql')
    expect(migration).toMatch(/has_privileged_mfa/)
    expect(migration).toMatch(/profiles_select_self_or_scoped/)
    expect(migration).toMatch(/payment_proofs_owner_or_payment_admin_read/)
    expect(migration).toMatch(/notifications_select_self/)
  })

  it('keeps the client free of server-only environment prefixes', () => {
    const source = readSourceTree('src')
    expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|TELEGRAM_BOT_TOKEN|CRON_SECRET|GEMINI_API_KEY/)
  })
})
