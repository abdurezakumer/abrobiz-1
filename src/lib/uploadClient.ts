import { edgeFunctionError } from './errors'
import { supabase } from './supabaseClient'

type UploadResponse = Record<string, unknown>

interface BinaryUploadOptions {
  functionName: string
  bytes: ArrayBuffer
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

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (options.signal?.aborted) throw new Error('Upload canceled.')
      if (typeof XMLHttpRequest === 'undefined' || !projectUrl || !anonKey) {
        const { data, error } = await supabase.functions.invoke(options.functionName, {
          body: options.bytes,
          headers: { ...options.headers, 'Content-Type': options.contentType },
          signal: options.signal,
        })
        if (error) throw await edgeFunctionError(error)
        options.onProgress?.(100)
        if (!data || typeof data !== 'object') throw new Error('Upload did not return a file reference.')
        return data as UploadResponse
      }

      const response = await sendWithXhr({ ...options, projectUrl, anonKey, accessToken })
      options.onProgress?.(100)
      return response
    } catch (error) {
      lastError = error
      const status = (error as { status?: number } | null)?.status
      const message = error instanceof Error ? error.message : ''
      if (options.signal?.aborted || /upload canceled/i.test(message)) throw error

      const retryable = !status || status === 401 || status === 408 || status >= 500 || /network|timed out|temporarily unavailable|could not save|failed to fetch|gateway/i.test(message)
      if (!retryable || attempt === 2) throw error

      if (status === 401) {
        const refreshed = await supabase.auth.refreshSession()
        if (!refreshed.error && refreshed.data.session) accessToken = refreshed.data.session.access_token
      }
      options.onProgress?.(0)
      await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('The upload could not be completed.')
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
      if (request.status < 200 || request.status >= 300) {
        const error = new Error(body?.error || body?.message || `Upload failed with status ${request.status}.`)
        ;(error as Error & { status?: number }).status = request.status
        reject(error)
        return
      }
      if (!body || typeof body !== 'object') {
        reject(new Error('Upload did not return a file reference.'))
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
