// Let phone galleries expose their native photo format. The client/server
// validators below still accept only safe, normalized image formats.
export const IMAGE_UPLOAD_ACCEPT = 'image/*'
// Payment receipts use the same photo picker behavior as logos and covers.
export const PAYMENT_UPLOAD_ACCEPT = IMAGE_UPLOAD_ACCEPT

// Keep the native file input in the accessibility tree. Some mobile Safari
// and Android WebView versions do not open a picker when the input uses the
// `hidden` attribute/display:none, even when it is wrapped by a label.
export const fileInputStyle = {
  position: 'absolute' as const,
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden' as const,
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap' as const,
  border: 0,
  opacity: 0.01,
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif'])

/**
 * Some older mobile browsers do not expose crypto.randomUUID(), while the
 * payment-proof endpoint still requires a UUID-shaped idempotency key. Keep
 * the fallback cryptographically random so retries remain safe and do not
 * collide with another upload.
 */
export function createClientUuid(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    cryptoApi.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  throw new Error('This browser cannot securely start the upload. Please update your browser and try again.')
}

/** Mobile browsers do not all report the same MIME type for camera photos. */
export function detectedUploadType(file: File): string {
  const type = file.type.trim().toLowerCase()
  if (type === 'image/jpg') return 'image/jpeg'
  if (IMAGE_TYPES.has(type) || type === 'application/pdf') return type
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'heic') return 'image/heic'
  if (extension === 'heif') return 'image/heif'
  if (extension === 'avif') return 'image/avif'
  if (extension === 'pdf') return 'application/pdf'
  return ''
}

export function isPdfFile(file: File): boolean {
  return detectedUploadType(file) === 'application/pdf'
}

/**
 * Read a file input once and clear it immediately. Clearing the input lets a
 * user select the same file again on mobile without navigating or refreshing
 * the page.
 */
export function takeSelectedFile(input: HTMLInputElement): File | null {
  const file = input.files?.[0] ?? null
  input.value = ''
  return file
}

/** File.arrayBuffer() is missing in some older mobile WebViews. */
export async function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()
  if (typeof FileReader === 'undefined') throw new Error('This browser cannot read the selected photo. Please update your browser and try again.')
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result)
      else reject(new Error('This browser could not read the selected photo. Please try another photo.'))
    }
    reader.onerror = () => reject(new Error('This browser could not read the selected photo. Please try another photo.'))
    reader.onabort = () => reject(new Error('Reading the selected photo was interrupted.'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Camera photos can be much larger than the storage limit. Compress only
 * oversized supported images in the browser before sending them, keeping the
 * request small enough for mobile networks and the upload function.
 */
export async function prepareImageForUpload(file: File, maxBytes: number, preferredMime?: 'image/jpeg' | 'image/webp'): Promise<File> {
  const detectedType = detectedUploadType(file)
  if (!IMAGE_TYPES.has(detectedType)) {
    throw new Error('Please choose a JPEG, PNG, or WebP image.')
  }
  const mustConvert = !['image/jpeg', 'image/png', 'image/webp'].includes(detectedType) || Boolean(preferredMime && detectedType !== preferredMime)
  if (!mustConvert && file.size <= maxBytes && file.type === detectedType) return file
  if (!mustConvert && file.size <= maxBytes) return new File([file], file.name, { type: detectedType })

  const maxDimension = 2400
  // Downsample during decode where supported. This avoids creating a full
  // 12–48 MP camera bitmap in mobile memory before drawing the smaller copy.
  const image = await decodeImage(file, maxDimension)
  let blob: Blob | null
  try {
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not prepare the image. Please choose a smaller file.')
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height)
    blob = await imageBlob(canvas, maxBytes, preferredMime)
  } finally {
    image.close()
  }
  if (!blob) throw new Error('This browser could not prepare the image. Please choose a smaller file.')
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const name = file.name.replace(/\.[^.]+$/, '') || 'upload'
  return new File([blob], `${name}.${extension}`, { type: blob.type })
}

type DecodedImage = {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

async function decodeImage(file: File, maxDecodeWidth: number): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Preserve the camera's EXIF orientation where the browser supports it.
      // Safari and some Android WebViews expose createImageBitmap but reject
      // particular camera/HEIC files, so the HTMLImageElement path below is a
      // required compatibility fallback rather than an optional enhancement.
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
        resizeWidth: maxDecodeWidth,
        resizeQuality: 'high',
      })
      if (bitmap.width > 0 && bitmap.height > 0) {
        return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
      }
      bitmap.close()
    } catch {
      // Fall through to the object-URL decoder used by mobile Safari.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const element = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => {
        if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(image)
        else reject(new Error('This browser could not read the image. Please choose a JPEG or PNG file.'))
      }
      image.onerror = () => reject(new Error('This browser could not read the image. Please choose a JPEG or PNG file.'))
      image.src = url
    })
    return { source: element, width: element.naturalWidth, height: element.naturalHeight, close: () => URL.revokeObjectURL(url) }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

async function imageBlob(canvas: HTMLCanvasElement, maxBytes: number, preferredMime?: 'image/jpeg' | 'image/webp'): Promise<Blob | null> {
  const formats = preferredMime ? [preferredMime] : ['image/webp', 'image/jpeg'] as const
  for (const format of formats) {
    const qualities = format === 'image/jpeg' ? [0.82, 0.68, 0.54, 0.4, 0.3, 0.2] : [0.82, 0.68, 0.54, 0.4]
    for (const quality of qualities) {
      const blob = await canvasBlob(canvas, format, quality)
      if (blob && blob.size <= maxBytes) return blob
    }
  }
  return null
}

async function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  if (typeof canvas.toBlob === 'function') {
    return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality))
  }
  // Older iOS WebViews have canvas.toDataURL but no canvas.toBlob.
  try {
    const dataUrl = canvas.toDataURL(type, quality)
    const comma = dataUrl.indexOf(',')
    if (comma < 0) return null
    const binary = atob(dataUrl.slice(comma + 1))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return new Blob([bytes], { type: dataUrl.slice(5, comma).split(';', 1)[0] || type })
  } catch {
    return null
  }
}
