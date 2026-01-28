import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import api from '../lib/api'
import { useAuth } from './AuthContext'

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  owner_id: string
  path: string
  depth: number | null
  is_root: boolean | null
  starred: boolean | null
  color: string | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export interface FileRecord {
  id: string
  name: string
  file_type: string
  file_extension: string | null
  size_bytes: number
  folder_id: string | null
  owner_id: string
  storage_path: string
  bucket_name: string | null
  upload_status: string | null
  thumbnail_path: string | null
  starred: boolean | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

interface FileContextType {
  currentFolder: Folder | null
  currentFolderId: string | null
  setCurrentFolderId: (id: string | null) => void
  folders: Folder[]
  foldersLoading: boolean
  foldersError: string | null
  createFolder: (name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  files: FileRecord[]
  filesLoading: boolean
  filesError: string | null
  deleteFile: (id: string) => Promise<void>
  navigateToFolder: (folder: Folder | null) => void
  navigateUp: () => void
  refresh: () => Promise<void>
}

const FileContext = createContext<FileContextType | undefined>(undefined)

export function FileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<FileRecord[]>([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [filesLoading, setFilesLoading] = useState(false)
  const [foldersError, setFoldersError] = useState<string | null>(null)
  const [filesError, setFilesError] = useState<string | null>(null)

  const fetchFolders = useCallback(async () => {
    if (!user) return
    setFoldersLoading(true)
    setFoldersError(null)
    try {
      const data = await api.getFolders(currentFolderId)
      setFolders(data)
    } catch (err) {
      setFoldersError(err instanceof Error ? err.message : 'Failed to load folders')
    } finally {
      setFoldersLoading(false)
    }
  }, [user, currentFolderId])

  const fetchFiles = useCallback(async () => {
    if (!user) return
    setFilesLoading(true)
    setFilesError(null)
    try {
      const data = await api.getFiles(currentFolderId)
      setFiles(data)
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : 'Failed to load files')
    } finally {
      setFilesLoading(false)
    }
  }, [user, currentFolderId])

  const refresh = useCallback(async () => {
    await Promise.all([fetchFolders(), fetchFiles()])
  }, [fetchFolders, fetchFiles])

  // Auto-fetch when user or folder changes
  useEffect(() => {
    if (user) {
      refresh()
    }
  }, [user, currentFolderId])

  const createFolder = useCallback(async (name: string) => {
    await api.createFolder(name, currentFolderId)
    await fetchFolders()
  }, [currentFolderId, fetchFolders])

  const deleteFolder = useCallback(async (id: string) => {
    await api.deleteFolder(id)
    await fetchFolders()
  }, [fetchFolders])

  const deleteFile = useCallback(async (id: string) => {
    await api.deleteFile(id)
    await fetchFiles()
  }, [fetchFiles])

  const navigateToFolder = useCallback((folder: Folder | null) => {
    setCurrentFolderId(folder?.id || null)
    setCurrentFolder(folder)
  }, [])

  const navigateUp = useCallback(() => {
    if (currentFolder?.parent_id) {
      setCurrentFolderId(currentFolder.parent_id)
    } else {
      setCurrentFolderId(null)
      setCurrentFolder(null)
    }
  }, [currentFolder])

  return (
    <FileContext.Provider value={{
      currentFolder,
      currentFolderId,
      setCurrentFolderId,
      folders,
      foldersLoading,
      foldersError,
      createFolder,
      deleteFolder,
      files,
      filesLoading,
      filesError,
      deleteFile,
      navigateToFolder,
      navigateUp,
      refresh,
    }}>
      {children}
    </FileContext.Provider>
  )
}

export function useFiles() {
  const context = useContext(FileContext)
  if (context === undefined) {
    throw new Error('useFiles must be used within a FileProvider')
  }
  return context
}
