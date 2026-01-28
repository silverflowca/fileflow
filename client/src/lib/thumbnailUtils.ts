import { supabase } from './supabase'

// Thumbnail settings
const THUMBNAIL_MAX_WIDTH = 400
const THUMBNAIL_MAX_HEIGHT = 400
const THUMBNAIL_QUALITY = 0.8
const VIDEO_THUMBNAIL_TIME = 1 // seconds into video to capture

export interface ThumbnailResult {
  blob: Blob
  width: number
  height: number
  dataUrl: string
}

export interface ImageDimensions {
  width: number
  height: number
}

/**
 * Generate a thumbnail from an image file
 */
export async function generateImageThumbnail(file: File): Promise<ThumbnailResult> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { width, height } = calculateDimensions(img.width, img.height)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create thumbnail blob'))
            return
          }

          resolve({
            blob,
            width,
            height,
            dataUrl: canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY),
          })
        },
        'image/jpeg',
        THUMBNAIL_QUALITY
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Generate a thumbnail from a video file
 */
export async function generateVideoThumbnail(file: File): Promise<ThumbnailResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = () => {
      // Seek to thumbnail capture time
      video.currentTime = Math.min(VIDEO_THUMBNAIL_TIME, video.duration / 2)
    }

    video.onseeked = () => {
      const { width, height } = calculateDimensions(video.videoWidth, video.videoHeight)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(video, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)

          if (!blob) {
            reject(new Error('Failed to create thumbnail blob'))
            return
          }

          resolve({
            blob,
            width,
            height,
            dataUrl: canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY),
          })
        },
        'image/jpeg',
        THUMBNAIL_QUALITY
      )
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video'))
    }

    video.src = url
  })
}

/**
 * Get dimensions of an image file
 */
export async function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.width, height: img.height })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Get dimensions of a video file
 */
export async function getVideoDimensions(file: File): Promise<ImageDimensions & { duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)

    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video'))
    }

    video.src = url
  })
}

/**
 * Get duration of an audio file
 */
export async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)

    audio.preload = 'metadata'

    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(audio.duration)
    }

    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load audio'))
    }

    audio.src = url
  })
}

/**
 * Calculate thumbnail dimensions while maintaining aspect ratio
 */
function calculateDimensions(originalWidth: number, originalHeight: number): { width: number; height: number } {
  let width = originalWidth
  let height = originalHeight

  if (width > THUMBNAIL_MAX_WIDTH) {
    height = (height * THUMBNAIL_MAX_WIDTH) / width
    width = THUMBNAIL_MAX_WIDTH
  }

  if (height > THUMBNAIL_MAX_HEIGHT) {
    width = (width * THUMBNAIL_MAX_HEIGHT) / height
    height = THUMBNAIL_MAX_HEIGHT
  }

  return { width: Math.round(width), height: Math.round(height) }
}

/**
 * Upload thumbnail to storage and return the path
 */
export async function uploadThumbnail(
  thumbnailBlob: Blob,
  userId: string,
  originalFileName: string
): Promise<string> {
  const thumbnailName = `thumb_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`
  const thumbnailPath = `${userId}/thumbnails/${thumbnailName}`

  const { error } = await supabase.storage
    .from('files')
    .upload(thumbnailPath, thumbnailBlob, {
      cacheControl: '31536000', // Cache for 1 year
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (error) throw error

  return thumbnailPath
}

/**
 * Check if a file type supports thumbnail generation
 */
export function supportsThumbnail(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType.startsWith('video/')
}

/**
 * Generate and upload thumbnail for a file
 */
export async function processFileForThumbnail(
  file: File,
  userId: string
): Promise<{
  thumbnailPath: string | null
  dimensions: ImageDimensions | null
  duration: number | null
}> {
  const mimeType = file.type

  try {
    // Images
    if (mimeType.startsWith('image/')) {
      const thumbnail = await generateImageThumbnail(file)
      const thumbnailPath = await uploadThumbnail(thumbnail.blob, userId, file.name)
      const dimensions = await getImageDimensions(file)

      return {
        thumbnailPath,
        dimensions,
        duration: null,
      }
    }

    // Videos
    if (mimeType.startsWith('video/')) {
      const thumbnail = await generateVideoThumbnail(file)
      const thumbnailPath = await uploadThumbnail(thumbnail.blob, userId, file.name)
      const videoInfo = await getVideoDimensions(file)

      return {
        thumbnailPath,
        dimensions: { width: videoInfo.width, height: videoInfo.height },
        duration: Math.round(videoInfo.duration),
      }
    }

    // Audio - no thumbnail, just duration
    if (mimeType.startsWith('audio/')) {
      const duration = await getAudioDuration(file)

      return {
        thumbnailPath: null,
        dimensions: null,
        duration: Math.round(duration),
      }
    }

    // Other file types - no processing
    return {
      thumbnailPath: null,
      dimensions: null,
      duration: null,
    }
  } catch (error) {
    console.error('Error processing file for thumbnail:', error)
    // Return nulls on error - file can still be uploaded without thumbnail
    return {
      thumbnailPath: null,
      dimensions: null,
      duration: null,
    }
  }
}
