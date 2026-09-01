import { describe, expect, it } from 'vitest'
import { safeHttpsUrl, safeImageUrl, safeInternalPath, safeMailto, safeTel, safeTelegramUrl } from '../safeUrl'

describe('safe browser URLs', () => {
  it('rejects executable and non-HTTPS external protocols', () => {
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpsUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeHttpsUrl('http://example.com')).toBeNull()
    expect(safeImageUrl('vbscript:msgbox(1)')).toBeNull()
  })

  it('allows HTTPS images and safe relative images only', () => {
    expect(safeImageUrl('https://cdn.example.test/photo.webp')).toBe('https://cdn.example.test/photo.webp')
    expect(safeImageUrl('/storage/photo.webp')).toBe('/storage/photo.webp')
    expect(safeImageUrl('//evil.example/photo.webp')).toBeNull()
  })

  it('keeps redirect destinations same-origin', () => {
    expect(safeInternalPath('/dashboard?tab=orders')).toBe('/dashboard?tab=orders')
    expect(safeInternalPath('https://evil.example/steal', '/dashboard')).toBe('/dashboard')
    expect(safeInternalPath('//evil.example/steal', '/dashboard')).toBe('/dashboard')
    expect(safeInternalPath('/\\\\evil.example', '/dashboard')).toBe('/dashboard')
  })

  it('constrains contact and Telegram links', () => {
    expect(safeMailto('owner@example.com')).toBe('mailto:owner%40example.com')
    expect(safeMailto('x@example.com\r\nBcc:evil@example.com')).toBeNull()
    expect(safeTel('+251 911 000 000')).toContain('tel:')
    expect(safeTelegramUrl('@abrobiz_bot')).toBe('https://t.me/abrobiz_bot')
    expect(safeTelegramUrl('javascript:alert(1)')).toBeNull()
  })
})
