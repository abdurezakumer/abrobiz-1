export type AllowedFileExtension = 'jpg' | 'png' | 'webp' | 'pdf'

/** Validate file content by signature, not by filename or MIME alone. */
export function detectAllowedFile(
  contentType: string,
  bytes: Uint8Array,
  allowPdf = false,
): AllowedFileExtension | null {
  const isJpeg = bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    && hasMarkerNearEnd(bytes, 0xff, 0xd9)
  const isPng = bytes.length >= 20 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    && hasTextNearEnd(bytes, 'IEND')
  const riffSize = bytes.length >= 8
    ? bytes[4] + bytes[5] * 0x100 + bytes[6] * 0x10000 + bytes[7] * 0x1000000
    : -1
  const isWebp = bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP'
    && riffSize >= 4 && riffSize + 8 <= bytes.length
  const isPdf = bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-'
  if (contentType === 'image/jpeg' && isJpeg) return 'jpg'
  if (contentType === 'image/png' && isPng) return 'png'
  if (contentType === 'image/webp' && isWebp) return 'webp'
  if (allowPdf && contentType === 'application/pdf' && isPdf) return 'pdf'
  return null
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end))
}

// Camera/export tools may append harmless metadata or padding after the
// logical end marker. Keep the scan bounded while still requiring the marker
// to be close to the end of the payload.
function hasMarkerNearEnd(bytes: Uint8Array, first: number, second: number): boolean {
  const start = Math.max(0, bytes.length - 64 * 1024)
  for (let index = bytes.length - 2; index >= start; index -= 1) {
    if (bytes[index] === first && bytes[index + 1] === second) return true
  }
  return false
}

function hasTextNearEnd(bytes: Uint8Array, value: string): boolean {
  const start = Math.max(0, bytes.length - 64 * 1024)
  for (let index = bytes.length - value.length; index >= start; index -= 1) {
    if (ascii(bytes, index, index + value.length) === value) return true
  }
  return false
}

export function safeStoragePath(businessId: string, extension: AllowedFileExtension): string {
  return `${businessId}/${crypto.randomUUID()}.${extension}`
}
