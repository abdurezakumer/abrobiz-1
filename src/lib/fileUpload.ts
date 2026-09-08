export const IMAGE_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp'
export const PAYMENT_UPLOAD_ACCEPT = `${IMAGE_UPLOAD_ACCEPT},application/pdf`

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

/**
 * Camera photos can be much larger than the storage limit. Compress only
 * oversized supported images in the browser before sending them, keeping the
 * request small enough for mobile networks and the upload function.
 */
export async function prepareImageForUpload(file: File, maxBytes: number): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Please choose a JPEG, PNG, or WebP image.')
  }
  if (file.size <= maxBytes) return file

  const image = await decodeImage(file)
  const maxDimension = 2400
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not prepare the image. Please choose a smaller file.')
  context.drawImage(image.source, 0, 0, canvas.width, canvas.height)
  image.close()

  const blob = await imageBlob(canvas, maxBytes)
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

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  }

  const url = URL.createObjectURL(file)
  try {
    const element = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('This browser could not read the image. Please choose a JPEG or PNG file.'))
      image.src = url
    })
    return { source: element, width: element.naturalWidth, height: element.naturalHeight, close: () => URL.revokeObjectURL(url) }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

async function imageBlob(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob | null> {
  for (const quality of [0.82, 0.68, 0.54, 0.4]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
    if (blob && blob.size <= maxBytes) return blob
  }
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.35))
}
