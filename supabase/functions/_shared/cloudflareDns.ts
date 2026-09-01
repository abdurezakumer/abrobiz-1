import { fetchWithTimeout, readJsonResponse } from './external.ts'
import { logEvent } from './observability.ts'

const PLATFORM_DOMAIN = 'abrobiz.com'
const ZONE_ID_PATTERN = /^[a-f0-9]{32}$/i
const RECORD_ID_PATTERN = /^[a-f0-9]{32}$/i
const HOSTNAME_PATTERN = /^(?:\*\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/
const ALLOWED_TYPES = new Set(['A', 'AAAA', 'CNAME', 'TXT'])
const RESERVED_TENANT_SLUGS = new Set([
  'www', 'api', 'auth', 'admin', 'app', 'dashboard', 'mail', 'smtp', 'ftp', 'cdn', 'static', 'assets',
  'support', 'status', 'billing', 'payments', 'storage', 'dev', 'staging', 'test', 'login', 'register', 'setup',
])

export type CloudflareRecordType = 'A' | 'AAAA' | 'CNAME' | 'TXT'
export interface DnsRecordInput {
  name: string
  type: CloudflareRecordType
  content: string
  ttl?: number
  proxied?: boolean
}

export interface CloudflareRecord {
  id: string
  name: string
  type: CloudflareRecordType
  content: string
}

function validateRecordName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/\.$/, '')
  if (!HOSTNAME_PATTERN.test(normalized)) throw new Error('Invalid DNS record name')
  const withoutWildcard = normalized.startsWith('*.') ? normalized.slice(2) : normalized
  if (withoutWildcard !== PLATFORM_DOMAIN && !withoutWildcard.endsWith(`.${PLATFORM_DOMAIN}`)) {
    throw new Error('DNS record is outside the AbroBiz zone')
  }
  const labels = normalized.split('.')
  if (labels.length > 3 || (labels[0] === '*' && labels.length !== 3)) throw new Error('DNS record depth is not allowed')
  return normalized
}

function validateRecord(record: DnsRecordInput): DnsRecordInput {
  const name = validateRecordName(record.name)
  if (!ALLOWED_TYPES.has(record.type)) throw new Error('DNS record type is not allowed')
  if (typeof record.content !== 'string' || !record.content.trim() || record.content.length > 1024 || /[\u0000-\u001f\u007f]/.test(record.content)) {
    throw new Error('DNS record content is invalid')
  }
  if (record.type === 'CNAME' && !HOSTNAME_PATTERN.test(record.content.trim().toLowerCase().replace(/\.$/, ''))) {
    throw new Error('CNAME target is invalid')
  }
  if (record.proxied && record.type !== 'A' && record.type !== 'AAAA' && record.type !== 'CNAME') {
    throw new Error('This DNS record type cannot be proxied')
  }
  return { ...record, name, content: record.content.trim(), ttl: record.ttl ?? 1, proxied: record.proxied ?? false }
}

function validateId(id: string): string {
  if (!RECORD_ID_PATTERN.test(id)) throw new Error('Invalid DNS record id')
  return id
}

/** Server-only Cloudflare DNS client. Never import this from browser code. */
export class CloudflareDnsClient {
  private constructor(private readonly token: string, private readonly zoneId: string) {}

  static fromEnv(env: { get(key: string): string | undefined } = Deno.env): CloudflareDnsClient {
    const token = env.get('CLOUDFLARE_API_TOKEN')
    const zoneId = env.get('CLOUDFLARE_ZONE_ID')
    if (!token || !zoneId || !ZONE_ID_PATTERN.test(zoneId)) throw new Error('Cloudflare DNS configuration is unavailable')
    return new CloudflareDnsClient(token, zoneId)
  }

  private async request(path: string, init: RequestInit = {}): Promise<any> {
    const readOnly = !init.method || init.method.toUpperCase() === 'GET'
    let lastStatus = 503
    for (let attempt = 1; attempt <= (readOnly ? 2 : 1); attempt++) {
      try {
        const response = await fetchWithTimeout(`https://api.cloudflare.com/client/v4/zones/${this.zoneId}${path}`, {
          ...init,
          headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
        }, 8000)
        lastStatus = response.status
        const body = await readJsonResponse(response, 128 * 1024).catch(() => null)
        if (response.ok && body?.success) return body.result
        if (!readOnly || ![502, 503, 504].includes(response.status)) break
      } catch {
        if (!readOnly || attempt === 2) break
      }
    }
    logEvent('error', { service: 'abrobiz-edge', function_name: 'cloudflare-dns', operation: 'api_request', provider: 'cloudflare', status: lastStatus, error_category: 'DEPENDENCY_ERROR', outcome: 'failed' })
    throw new Error('Cloudflare DNS request failed')
  }

  async findDnsRecord(name: string, type?: CloudflareRecordType): Promise<CloudflareRecord[]> {
    const safeName = validateRecordName(name)
    const safeType = type ? (ALLOWED_TYPES.has(type) ? type : (() => { throw new Error('DNS record type is not allowed') })()) : undefined
    const query = new URLSearchParams({ name: safeName })
    if (safeType) query.set('type', safeType)
    const result = await this.request(`/dns_records?${query.toString()}`)
    return Array.isArray(result) ? result.map(row => ({ id: String(row.id), name: String(row.name), type: row.type as CloudflareRecordType, content: String(row.content) })) : []
  }

  async createDnsRecord(record: DnsRecordInput): Promise<CloudflareRecord> {
    const safe = validateRecord(record)
    // Tenant provisioning should use the wildcard record and not call this
    // method. The client is reserved for explicitly approved exceptional DNS.
    const result = await this.request('/dns_records', { method: 'POST', body: JSON.stringify(safe) })
    return { id: String(result.id), name: String(result.name), type: result.type as CloudflareRecordType, content: String(result.content) }
  }

  async updateDnsRecord(id: string, record: DnsRecordInput): Promise<CloudflareRecord> {
    const safe = validateRecord(record)
    const result = await this.request(`/dns_records/${validateId(id)}`, { method: 'PUT', body: JSON.stringify(safe) })
    return { id: String(result.id), name: String(result.name), type: result.type as CloudflareRecordType, content: String(result.content) }
  }

  async deleteDnsRecord(id: string): Promise<void> {
    await this.request(`/dns_records/${validateId(id)}`, { method: 'DELETE' })
  }
}

/** Deterministic result for tenant creation under the one-wildcard model. */
export function tenantDnsProvisioning(slug: string): { mode: 'wildcard'; hostname: string; recordCreated: false } {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(slug) || slug.length > 63 || RESERVED_TENANT_SLUGS.has(slug)) throw new Error('Invalid tenant slug')
  return { mode: 'wildcard', hostname: `${slug}.${PLATFORM_DOMAIN}`, recordCreated: false }
}
