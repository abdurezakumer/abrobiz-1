export function friendlyError(error: unknown): string {
  const raw = error as { message?: string; error_description?: string; details?: string; hint?: string; code?: string } | null
  const msg = error instanceof Error
    ? error.message
    : raw?.message || raw?.error_description || raw?.details || (error ? JSON.stringify(error) : '')
  if (/row-level security/i.test(msg)) {
    return "You don't have permission to do that. If this keeps happening, make sure you're logged in and try again."
  }
  if (/too many requests|rate limit/i.test(msg)) return 'Too many requests. Please wait a few minutes and try again.'
  if (/JWT expired/i.test(msg)) return 'Your session expired — please log in again.'
  if (/exceeded the maximum/i.test(msg) || /Payload too large/i.test(msg)) return 'That file is too large.'
  if (/Bucket not found/i.test(msg)) return "Storage isn't set up correctly yet — contact support."
  return msg || 'Something went wrong. Please try again.'
}

/** Supabase FunctionsHttpError keeps the JSON response in `context`, while
 * its generic message only says the request failed. Read the server's safe
 * error field so email failures are actionable in the dashboard. */
export async function edgeFunctionError(error: unknown): Promise<Error> {
  const candidate = error as { context?: Response; message?: string } | null
  const response = candidate?.context
  if (response && typeof response.clone === 'function') {
    try {
      const body = await response.clone().json() as { error?: string; message?: string }
      if (body.error || body.message) return new Error(body.error || body.message)
    } catch {
      // Keep the original error below when the response is not JSON.
    }
  }
  return new Error(candidate?.message || 'The AbroBiz email service is unavailable. Please try again.')
}
