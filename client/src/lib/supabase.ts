import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:55321'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

console.log('[Supabase] Initializing:', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  keyLength: supabaseAnonKey?.length
})

if (!supabaseAnonKey) {
  console.error('❌ VITE_SUPABASE_ANON_KEY is not set!')
} else {
  console.log('✅ Supabase configured')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  db: {
    schema: 'fileflow',
  },
})

// Helper to get signed URL for file download
// Automatically refreshes the session before calling storage to avoid token-expiry 400s
export async function getFileUrl(bucket: string, path: string, expiresIn = 3600) {
  // Ensure session is fresh before making storage request
  await supabase.auth.getSession()

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error) {
    if (error.message?.toLowerCase().includes('not found') || (error as any).statusCode === 400) {
      console.warn(`[FileFlow] Object not found in storage: ${path}`)
      return null
    }
    console.error('Error creating signed URL:', error)
    return null
  }

  return data.signedUrl
}

// Helper to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// Helper to get file extension
export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

// Helper to get MIME type category
export function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'spreadsheet'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return 'archive'
  if (mimeType.includes('text')) return 'text'
  return 'other'
}
