export interface ParsedJsonBody {
  data?: unknown
  error?: string
  status?: number
}

/**
 * Read a JSON request without allowing an attacker to hand the runtime an
 * arbitrarily large body. Content-Length is only an early rejection; the
 * buffered byte count remains authoritative for chunked requests.
 */
export async function readJsonBody(req: Request, maxBytes: number): Promise<ParsedJsonBody> {
  const contentType = req.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json' && !contentType?.endsWith('+json')) {
    return { error: 'JSON content is required.', status: 415 }
  }

  const declaredLength = Number(req.headers.get('content-length') ?? '')
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { error: 'Request body is too large.', status: 413 }
  }

  const bytes = new Uint8Array(await req.arrayBuffer())
  if (bytes.byteLength > maxBytes) return { error: 'Request body is too large.', status: 413 }
  if (bytes.byteLength === 0) return { error: 'A JSON body is required.', status: 400 }

  try {
    return { data: JSON.parse(new TextDecoder().decode(bytes)) }
  } catch {
    return { error: 'Invalid JSON body.', status: 400 }
  }
}

export async function readBinaryBody(req: Request, maxBytes: number): Promise<{ bytes?: Uint8Array; error?: string; status?: number }> {
  const declaredLength = Number(req.headers.get('content-length') ?? '')
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { error: 'File is too large.', status: 413 }
  }
  const bytes = new Uint8Array(await req.arrayBuffer())
  if (bytes.byteLength === 0) return { error: 'A file is required.', status: 400 }
  if (bytes.byteLength > maxBytes) return { error: 'File is too large.', status: 413 }
  return { bytes }
}

/** Consume and bound a request body for endpoints that do not accept a body. */
export async function readBoundedBody(req: Request, maxBytes: number): Promise<{ error?: string; status?: number }> {
  const declaredLength = Number(req.headers.get('content-length') ?? '')
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { error: 'Request body is too large.', status: 413 }
  }
  const bytes = new Uint8Array(await req.arrayBuffer())
  if (bytes.byteLength > maxBytes) return { error: 'Request body is too large.', status: 413 }
  return {}
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.length > maxLength) return null
  return value
}

export function validUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function validEmail(value: unknown, maxLength = 254): value is string {
  return typeof value === 'string'
    && value.length > 3
    && value.length <= maxLength
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Accept only the standard Authorization: Bearer <token> form. */
export function isBearerAuthorization(value: string | null): value is string {
  return typeof value === 'string' && /^Bearer\s+\S+$/.test(value.trim())
}
