/**
 * Small, dependency-free observability helpers for Supabase Edge Functions.
 *
 * Logs are intentionally allow-listed. Never pass request bodies, headers,
 * tokens, email addresses, phone numbers, payment details, or provider
 * responses to these helpers.
 */
export type LogSeverity = 'info' | 'warn' | 'error'

export type SafeLogFields = {
  service?: string
  function_name?: string
  operation?: string
  request_id?: string
  correlation_id?: string
  status?: number
  duration_ms?: number
  error_category?: string
  error_code?: string
  provider?: string
  outcome?: string
}

const requestIds = new WeakMap<Request, string>()
const safeId = /^[A-Za-z0-9._:-]{1,128}$/
const allowedFields = new Set<keyof SafeLogFields>([
  'service', 'function_name', 'operation', 'request_id', 'correlation_id',
  'status', 'duration_ms', 'error_category', 'error_code', 'provider', 'outcome',
])

function sanitize(value: unknown): string | number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return undefined
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 256)
}

export function requestId(req: Request): string {
  const existing = requestIds.get(req)
  if (existing) return existing
  const supplied = req.headers.get('X-Request-ID') ?? req.headers.get('X-Correlation-ID')
  const value = supplied && safeId.test(supplied) ? supplied : crypto.randomUUID()
  requestIds.set(req, value)
  return value
}

export function logEvent(severity: LogSeverity, fields: SafeLogFields): void {
  const safeFields: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(fields) as Array<[keyof SafeLogFields, unknown]>) {
    if (!allowedFields.has(key)) continue
    const cleaned = sanitize(value)
    if (cleaned !== undefined) safeFields[key] = cleaned
  }
  const event = {
    timestamp: new Date().toISOString(),
    severity,
    ...safeFields,
  }
  const line = JSON.stringify(event)
  if (severity === 'error') console.error(line)
  else if (severity === 'warn') console.warn(line)
  else console.log(line)
}

export function logFailure(
  req: Request,
  fields: Omit<SafeLogFields, 'request_id' | 'severity'> & { function_name: string; operation: string },
): void {
  logEvent('error', { ...fields, request_id: requestId(req) })
}

/** Adds a safe correlation header and emits one structured completion event. */
export function instrumentRequest(
  functionName: string,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async req => {
    const started = performance.now()
    const id = requestId(req)
    try {
      const response = await handler(req)
      const headers = new Headers(response.headers)
      headers.set('X-Request-ID', id)
      logEvent('info', {
        service: 'abrobiz-edge',
        function_name: functionName,
        operation: 'request',
        request_id: id,
        status: response.status,
        duration_ms: Math.round(performance.now() - started),
        outcome: response.ok ? 'success' : 'failure',
      })
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
    } catch (error) {
      logEvent('error', {
        service: 'abrobiz-edge',
        function_name: functionName,
        operation: 'request',
        request_id: id,
        status: 500,
        duration_ms: Math.round(performance.now() - started),
        error_category: 'INTERNAL_ERROR',
        error_code: error instanceof Error ? error.name : 'UnknownError',
        outcome: 'exception',
      })
      throw error
    }
  }
}
