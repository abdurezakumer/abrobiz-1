export type SecretCheck = 'ok' | 'missing' | 'invalid'

function constantTimeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left)
  const b = new TextEncoder().encode(right)
  if (a.length !== b.length) return false

  let difference = 0
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index]
  return difference === 0
}

export function checkSecret(provided: string | null | undefined, expected: string | undefined): SecretCheck {
  if (!expected || expected.trim() === '') return 'missing'
  if (!provided || !constantTimeEqual(provided, expected)) return 'invalid'
  return 'ok'
}

export function checkBearerSecret(authorization: string | null | undefined, expected: string | undefined): SecretCheck {
  if (!expected || expected.trim() === '') return 'missing'
  if (!authorization) return 'invalid'
  const match = authorization.trim().match(/^Bearer\s+(\S+)$/i)
  return checkSecret(match?.[1] ?? null, expected)
}
