import { createContext, useContext, useCallback, ReactNode } from 'react'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import api from '../lib/api'
import { useAuth } from './AuthContext'
import { useFiles } from './FileContext'
import { processFileForThumbnail } from '../lib/thumbnailUtils'

// Constants
const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks

export interface UploadItem {
  id: string
  file: File
  fileName: string
  totalSize: number
  uploadedSize: number
  progress: number
  status: 'queued' | 'uploading' | 'paused' | 'completed' | 'failed'
  error?: string
  folderId: string | null
  fileId?: string
  storagePath?: string
  chunksUploaded: number
  totalChunks: number
  startTime?: number
  speed?: number
}

interface UploadState {
  uploads: Map<string, UploadItem>
  activeUploads: number
  maxConcurrent: number
  addUpload: (item: UploadItem) => void
  updateUpload: (id: string, updates: Partial<UploadItem>) => void
  removeUpload: (id: string) => void
  clearCompleted: () => void
  getUpload: (id: string) => UploadItem | undefined
  getUploads: () => UploadItem[]
}

const useUploadStore = create<UploadState>((set, get) => ({
  uploads: new Map(),
  activeUploads: 0,
  maxConcurrent: 3,

  addUpload: (item) => set((state) => {
    const newUploads = new Map(state.uploads)
    newUploads.set(item.id, item)
    return { uploads: newUploads }
  }),

  updateUpload: (id, updates) => set((state) => {
    const newUploads = new Map(state.uploads)
    const existing = newUploads.get(id)
    if (existing) {
      newUploads.set(id, { ...existing, ...updates })
    }
    return { uploads: newUploads }
  }),

  removeUpload: (id) => set((state) => {
    const newUploads = new Map(state.uploads)
    newUploads.delete(id)
    return { uploads: newUploads }
  }),

  clearCompleted: () => set((state) => {
    const newUploads = new Map(state.uploads)
    for (const [id, upload] of newUploads) {
      if (upload.status === 'completed' || upload.status === 'failed') {
        newUploads.delete(id)
      }
    }
    return { uploads: newUploads }
  }),

  getUpload: (id) => get().uploads.get(id),
  getUploads: () => Array.from(get().uploads.values()),
}))

interface UploadContextType {
  uploads: UploadItem[]
  uploadFile: (file: File, folderId: string | null) => Promise<void>
  uploadFiles: (files: File[], folderId: string | null) => Promise<void>
  pauseUpload: (id: string) => void
  resumeUpload: (id: string) => void
  cancelUpload: (id: string) => void
  clearCompleted: () => void
  retryUpload: (id: string) => void
  totalProgress: number
  isUploading: boolean
}

const UploadContext = createContext<UploadContextType | undefined>(undefined)

export function UploadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { refresh } = useFiles()
  const store = useUploadStore()

  const generateUploadId = () => `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`

  const uploadFile = useCallback(async (file: File, folderId: string | null) => {
    if (!user) throw new Error('Not authenticated')

    const uploadId = generateUploadId()
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

    const uploadItem: UploadItem = {
      id: uploadId,
      file,
      fileName: file.name,
      totalSize: file.size,
      uploadedSize: 0,
      progress: 0,
      status: 'queued',
      folderId,
      chunksUploaded: 0,
      totalChunks,
    }

    store.addUpload(uploadItem)

    try {
      store.updateUpload(uploadId, { status: 'uploading', startTime: Date.now() })

      const fileExt = file.name.split('.').pop() || ''
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const storagePath = `${user.id}/${fileName}`

      store.updateUpload(uploadId, { storagePath })

      // Process thumbnail and metadata for images/videos/audio
      let thumbnailPath: string | undefined
      let dimensions: { width: number; height: number } | undefined
      let duration: number | undefined

      try {
        const processed = await processFileForThumbnail(file, user.id)
        thumbnailPath = processed.thumbnailPath || undefined
        dimensions = processed.dimensions || undefined
        duration = processed.duration || undefined
      } catch (err) {
        console.warn('Could not process thumbnail:', err)
      }

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      store.updateUpload(uploadId, { progress: 80, uploadedSize: file.size })

      // Create file record using API (bypasses RLS issues)
      await api.createFileRecord({
        name: file.name,
        file_type: file.type,
        file_extension: fileExt,
        size_bytes: file.size,
        folder_id: folderId,
        storage_path: storagePath,
        bucket_name: 'files',
        upload_status: 'completed',
        thumbnail_path: thumbnailPath,
        dimensions,
        duration_seconds: duration,
      })

      store.updateUpload(uploadId, {
        status: 'completed',
        progress: 100,
        uploadedSize: file.size,
        chunksUploaded: 1,
      })

      // Refresh file list
      await refresh()
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && (error.name === 'AbortError' || error.message?.includes('abort'))) {
        return
      }
      console.error('Upload error:', error)
      store.updateUpload(uploadId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Upload failed',
      })
    }
  }, [user, refresh])

  const uploadFiles = useCallback(async (files: File[], folderId: string | null) => {
    for (const file of files) {
      await uploadFile(file, folderId)
    }
  }, [uploadFile])

  const pauseUpload = useCallback((id: string) => {
    store.updateUpload(id, { status: 'paused' })
  }, [])

  const resumeUpload = useCallback(async (id: string) => {
    const upload = store.getUpload(id)
    if (!upload || upload.status !== 'paused') return
    // Resume is simplified - just retry the upload
    await retryUpload(id)
  }, [])

  const cancelUpload = useCallback(async (id: string) => {
    const upload = store.getUpload(id)
    if (!upload) return

    // Clean up storage if file was partially uploaded
    if (upload.storagePath) {
      try {
        await supabase.storage.from('files').remove([upload.storagePath])
      } catch (error) {
        console.error('Error cleaning up cancelled upload:', error)
      }
    }

    store.removeUpload(id)
  }, [])

  const retryUpload = useCallback(async (id: string) => {
    const upload = store.getUpload(id)
    if (!upload) return

    store.updateUpload(id, {
      status: 'queued',
      error: undefined,
      progress: 0,
      uploadedSize: 0,
      chunksUploaded: 0,
    })

    try {
      await uploadFile(upload.file, upload.folderId)
    } catch (error) {
      store.updateUpload(id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Retry failed',
      })
    }
  }, [uploadFile])

  const clearCompleted = useCallback(() => {
    store.clearCompleted()
  }, [])

  const uploads = store.getUploads()
  const isUploading = uploads.some(u => u.status === 'uploading')
  const totalProgress = uploads.length > 0
    ? Math.round(uploads.reduce((acc, u) => acc + u.progress, 0) / uploads.length)
    : 0

  return (
    <UploadContext.Provider value={{
      uploads,
      uploadFile,
      uploadFiles,
      pauseUpload,
      resumeUpload,
      cancelUpload,
      clearCompleted,
      retryUpload,
      totalProgress,
      isUploading,
    }}>
      {children}
    </UploadContext.Provider>
  )
}

export function useUpload() {
  const context = useContext(UploadContext)
  if (context === undefined) {
    throw new Error('useUpload must be used within an UploadProvider')
  }
  return context
}
