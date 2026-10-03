import { supabase } from './supabaseClient'

type UploadResponse = Record<string, unknown>
type UploadFailure = Error & { status?: number; requestId?: string }

interface BinaryUploadOptions {
  functionName: string
  /**
   * Keep the original File/Blob when possible. Converting a phone photo to an
   * ArrayBuffer first duplicates the entire payload in memory and can make
   * mobile Safari/Android WebViews terminate the page before the request is
   * sent. ArrayBuffer remains supported for callers that already have bytes.
   */
  bytes: ArrayBuffer | Blob
  contentType: string
  headers?: Record<string, string>
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

/**
 * Upload binary data to an authenticated Edge Function with mobile-friendly
 * progress reporting and safe retries. The caller supplies a stable upload ID
 * so a retry after a lost response can be recovered without creating a second
 * object.
 */
export async function uploadBinaryToFunction(options: BinaryUploadOptions): Promise<UploadResponse> {
  const projectUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) throw new Error('Not authenticated.')

  let accessToken = sessionData.session.access_token
  let lastError: unknown
  const preferFetch = shouldPreferFetchUpload()
  const canUseFetch = typeof fetch === 'function'
  const canUseXhr = typeof XMLHttpRequest !== 'undefined'
  const primaryTransport = preferFetch || !canUseXhr || !projectUrl || !anonKey ? 'fetch' : 'xhr'
  const fallbackTransport = primaryTransport === 'fetch' ? 'xhr' : 'fetch'

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (options.signal?.aborted) throw new Error('Upload canceled.')
      if (primaryTransport === 'fetch') {
        // Mobile Safari and Chrome can expose XHR but still fail binary XHR
        // uploads after the picker returns. Fetch uses the browser's native
        // request path and is more reliable for those devices. It cannot
        // expose upload byte progress, so show a steady in-progress state and
        // complete it when the server responds.
        options.onProgress?.(8)
        if (!canUseFetch) throw new Error('This browser cannot start the upload. Please update your browser and try again.')
        const response = await sendWithFetch({ ...options, projectUrl, anonKey, accessToken })
        options.onProgress?.(100)
        return response
      }

      if (!canUseXhr) throw new Error('This browser cannot start the upload. Please update your browser and try again.')
      const response = await sendWithXhr({ ...options, projectUrl, anonKey, accessToken })
      options.onProgress?.(100)
      return response
    } catch (error) {
      lastError = error
      const status = (error as { status?: number } | null)?.status
      const message = error instanceof Error ? error.message : ''
      if (options.signal?.aborted || /upload canceled/i.test(message)) throw error

      const retryable = !status || status === 401 || status === 408 || status >= 500 || /network|timed out|temporarily unavailable|could not save|failed to fetch|gateway/i.test(message)
      if (!retryable) throw error

      if (status === 401) {
        const refreshed = await supabase.auth.refreshSession()
        if (!refreshed.error && refreshed.data.session) accessToken = refreshed.data.session.access_token
      }
      if (attempt === 2) {
        // A mobile browser can fail one binary transport while the other
        // still works (especially after returning from the photo picker).
        // Try the alternate transport once before surfacing the error. The
        // caller's stable upload ID makes this safe if the server committed
        // the file but the first response was lost.
        try {
          if (fallbackTransport === 'fetch' && canUseFetch) {
            options.onProgress?.(8)
            const response = await sendWithFetch({ ...options, projectUrl, anonKey, accessToken })
            options.onProgress?.(100)
            return response
          }
          if (fallbackTransport === 'xhr' && canUseXhr) {
            const response = await sendWithXhr({ ...options, projectUrl, anonKey, accessToken })
            options.onProgress?.(100)
            return response
          }
        } catch (fallbackError) {
          if (options.signal?.aborted || /upload canceled/i.test(fallbackError instanceof Error ? fallbackError.message : '')) throw fallbackError
          lastError = fallbackError
        }
      }
      options.onProgress?.(0)
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('The upload could not be completed.')
}

function shouldPreferFetchUpload(): boolean {
  if (typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent ?? ''
  const isTouchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(userAgent) || isTouchMac
}

async function sendWithFetch(options: BinaryUploadOptions & { projectUrl: string; anonKey: string; accessToken: string }): Promise<UploadResponse> {
  const timeoutMs = 120000
  const timeoutController = typeof AbortController !== 'undefined' ? new AbortController() : null
  let timedOut = false
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const abortForCaller = () => timeoutController?.abort()
  if (options.signal?.aborted) throw new Error('Upload canceled.')
  if (timeoutController) {
    timeoutId = setTimeout(() => {
      timedOut = true
      timeoutController.abort()
    }, timeoutMs)
    options.signal?.addEventListener('abort', abortForCaller, { once: true })
  }

  try {
    const response = await fetch(`${options.projectUrl}/functions/v1/${options.functionName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        apikey: options.anonKey,
        'Content-Type': options.contentType,
        ...options.headers,
      },
      body: options.bytes,
      signal: timeoutController?.signal ?? options.signal,
    })
    const body = await parseFetchResponse(response)
    const requestId = response.headers.get('X-Request-ID')?.trim() || undefined
    if (!response.ok) {
      const error = new Error(body?.error || body?.message || `Upload failed with status ${response.status}.`)
      const failure = error as UploadFailure
      failure.status = response.status
      failure.requestId = requestId
      throw error
    }
    if (!body || typeof body !== 'object') {
      const error = new Error('Upload did not return a file reference.') as UploadFailure
      error.requestId = requestId
      throw error
    }
    return body
  } catch (error) {
    if (options.signal?.aborted) throw new Error('Upload canceled.', { cause: error })
    if (timedOut) throw new Error('Upload timed out while waiting for the server.', { cause: error })
    throw error
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', abortForCaller)
  }
}

async function parseFetchResponse(response: Response): Promise<{ error?: string; message?: string; [key: string]: unknown } | null> {
  const text = await response.text()
  if (!text) return null
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed as { error?: string; message?: string; [key: string]: unknown } : { error: text }
  } catch {
    return { error: text }
  }
}

async function sendWithXhr(options: BinaryUploadOptions & { projectUrl: string; anonKey: string; accessToken: string }): Promise<UploadResponse> {
  return await new Promise<UploadResponse>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${options.projectUrl}/functions/v1/${options.functionName}`)
    request.timeout = 120000
    request.setRequestHeader('Authorization', `Bearer ${options.accessToken}`)
    request.setRequestHeader('apikey', options.anonKey)
    request.setRequestHeader('Content-Type', options.contentType)
    for (const [name, value] of Object.entries(options.headers ?? {})) request.setRequestHeader(name, value)

    const abortRequest = () => request.abort()
    const cleanupAbort = () => options.signal?.removeEventListener('abort', abortRequest)
    if (options.signal?.aborted) {
      reject(new Error('Upload canceled.'))
      return
    }
    options.signal?.addEventListener('abort', abortRequest, { once: true })
    if (request.upload) request.upload.onprogress = event => {
      if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => {
      cleanupAbort()
      const body = parseResponse(request)
      const requestId = request.getResponseHeader('X-Request-ID')?.trim() || undefined
      if (request.status < 200 || request.status >= 300) {
        const error = new Error(body?.error || body?.message || `Upload failed with status ${request.status}.`)
        const failure = error as UploadFailure
        failure.status = request.status
        failure.requestId = requestId
        reject(error)
        return
      }
      if (!body || typeof body !== 'object') {
        const error = new Error('Upload did not return a file reference.') as UploadFailure
        error.requestId = requestId
        reject(error)
        return
      }
      resolve(body)
    }
    request.onerror = () => { cleanupAbort(); reject(new Error('Upload network connection was interrupted.')) }
    request.ontimeout = () => { cleanupAbort(); reject(new Error('Upload timed out while waiting for the server.')) }
    request.onabort = () => { cleanupAbort(); reject(new Error(options.signal?.aborted ? 'Upload canceled.' : 'Upload was interrupted before it finished.')) }
    request.send(options.bytes)
  })
}

function parseResponse(request: XMLHttpRequest): { error?: string; message?: string; [key: string]: unknown } | null {
  const response = request.response
  if (response && typeof response === 'object') return response as { error?: string; message?: string; [key: string]: unknown }

  let text = ''
  try { text = request.responseText || '' } catch { /* responseType=json can block responseText access. */ }
  if (!text && typeof response === 'string') text = response
  if (!text) return null
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed as { error?: string; message?: string; [key: string]: unknown } : { error: text }
  } catch {
    return { error: text }
  }
}
