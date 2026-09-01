function retryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /failed to fetch|network|timeout|temporarily unavailable|service unavailable|\b(502|503|504)\b/i.test(message)
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

/** Bounded retry for idempotent reads only. Never use this for mutations. */
export async function retryRead<T>(operation: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown
  const attempts = Math.max(1, maxAttempts)
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt + 1 >= attempts || !retryable(error)) throw error
      await wait(Math.min(1000, 250 * 2 ** attempt + Math.floor(Math.random() * 100)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Read failed')
}
