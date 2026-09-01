export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: init.signal ?? controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export async function readJsonResponse(response: Response, maxBytes: number): Promise<any> {
  const declaredLength = Number(response.headers.get('content-length') ?? '')
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error('External response is too large')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > maxBytes) throw new Error('External response is too large')
  return JSON.parse(new TextDecoder().decode(bytes))
}

