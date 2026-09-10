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
  if (/use a (JPEG|PNG|WebP)|file type/i.test(msg)) return 'That file type or size is not supported.'
  if (/not authenticated|admins only|permission denied/i.test(msg)) return 'Please sign in again and try once more.'
  if (/already awaiting review|already waiting for admin review|already.*pending/i.test(msg)) return 'Your payment is already waiting for admin confirmation. Please wait for the review notification.'
  if (/payment proof was not found|proof path is invalid/i.test(msg)) return 'Your receipt upload is no longer available. Please choose the receipt photo again.'
  if (/payment plan details are invalid/i.test(msg)) return 'That plan is no longer available at this price. Please choose the plan again.'
  if (/payment method is unavailable/i.test(msg)) return 'That payment method is no longer available. Please choose another method.'
  if (/subdomain.*(taken|reserved)|slug.*(taken|reserved)/i.test(msg)) return 'That website address is unavailable. Please choose another.'
  if (/github|repository|template/i.test(msg)) return 'That template could not be imported. Check the public GitHub repository link.'
  if (/email.*(service|send)|verification.*email/i.test(msg)) return 'The AbroBiz email service is temporarily unavailable. Please try again later.'
  if (/invalid or expired|already been used|reset link|verification link/i.test(msg)) return 'That link is invalid or expired. Please request a new one.'
  return 'Something went wrong. Please try again.'
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
