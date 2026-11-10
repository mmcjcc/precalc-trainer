/**
 * A photo of her notes, made small enough to send: a phone photo is several megabytes, and a page
 * of handwriting reads just as well at 1600 pixels. Drawn onto a canvas and saved as a JPEG, which
 * also drops the photo's location and camera data. All of it happens in the browser.
 */
import { TUTOR_LIMITS, type TutorCardsRequest } from '@/shared/tutor'

/** Longest edge sent, then the fallback when a dense page is still too big. */
export const PHOTO_EDGES: readonly { edge: number; quality: number }[] = [
  { edge: 1600, quality: 0.82 },
  { edge: 1200, quality: 0.7 },
  { edge: 900, quality: 0.6 },
]

/** The size that fits `edge` on its longer side, never larger than the photo itself. */
export function fitWithin(width: number, height: number, edge: number): { width: number; height: number } {
  const longer = Math.max(width, height)
  if (!(longer > 0)) return { width: 0, height: 0 }
  const scale = Math.min(1, edge / longer)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

interface Drawable {
  source: CanvasImageSource
  width: number
  height: number
  done: () => void
}

async function decode(file: Blob): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() }
    } catch {
      /* Some browsers refuse a type here that an <img> still shows. */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('unreadable'))
      img.src = url
    })
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const comma = text.indexOf(',')
      if (comma < 0) reject(new Error('unreadable'))
      else resolve(text.slice(comma + 1))
    }
    reader.onerror = () => reject(new Error('unreadable'))
    reader.readAsDataURL(blob)
  })
}

/** The photo as the tutor takes it. Throws when the file is not a picture the browser can open. */
export async function shrinkPhoto(file: Blob): Promise<TutorCardsRequest['image']> {
  const photo = await decode(file)
  try {
    if (!(photo.width > 0 && photo.height > 0)) throw new Error('unreadable')
    for (const { edge, quality } of PHOTO_EDGES) {
      const size = fitWithin(photo.width, photo.height, edge)
      const canvas = document.createElement('canvas')
      canvas.width = size.width
      canvas.height = size.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('unreadable')
      // Notes on a transparent PNG would turn black as a JPEG.
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, size.width, size.height)
      ctx.drawImage(photo.source, 0, 0, size.width, size.height)
      const blob = await toJpeg(canvas, quality)
      if (blob && blob.size <= TUTOR_LIMITS.imageBytes) return { mime: 'image/jpeg', data: await toBase64(blob) }
    }
    throw new Error('too_large')
  } finally {
    photo.done()
  }
}
