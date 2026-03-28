import { supabase } from './supabase'

export async function downloadFile(storagePath: string, bucketName: string, fileName: string) {
  try {
    // Get the file from storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(storagePath)

    if (error) throw error

    // Create a blob URL and trigger download
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Download error:', error)
    throw error
  }
}

export async function getFileUrl(storagePath: string, bucketName: string): Promise<string> {
  // Refresh session first to avoid token-expiry 400 errors on createSignedUrl
  await supabase.auth.getSession()

  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(storagePath, 3600) // 1 hour expiration

  if (error) {
    if (error.message?.toLowerCase().includes('not found') || (error as any).statusCode === 400) {
      console.warn(`[FileFlow] Object missing from storage bucket: ${storagePath}`)
      throw new Error('File not available — it may have been uploaded in a different environment.')
    }
    console.error('Error getting file URL:', error)
    throw error
  }
  return data.signedUrl
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎥'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return '📦'
  if (mimeType.includes('text')) return '📃'
  return '📄'
}

export function isPreviewable(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/') ||
    mimeType.includes('pdf') ||
    mimeType === 'text/plain'
  )
}
