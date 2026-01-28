// File and folder type definitions

export interface Profile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  role: 'admin' | 'power_user' | 'user' | 'guest'
  storage_quota_bytes: number
  storage_used_bytes: number
  created_at: string
  updated_at: string
}

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  owner_id: string
  workspace_id: string | null
  path: string
  depth: number
  is_root: boolean
  starred: boolean
  color: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface File {
  id: string
  name: string
  file_type: string
  file_extension: string | null
  size_bytes: number
  folder_id: string | null
  owner_id: string
  workspace_id: string | null
  storage_path: string
  bucket_name: string
  thumbnail_path: string | null
  duration_seconds: number | null
  dimensions: { width: number; height: number } | null
  upload_status: 'pending' | 'uploading' | 'completed' | 'failed'
  starred: boolean
  version: number
  parent_version_id: string | null
  tag_ids: string[]
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  deleted_at: string | null
  last_accessed_at: string | null
}

export interface Permission {
  id: string
  file_id: string | null
  folder_id: string | null
  user_id: string | null
  group_id: string | null
  permission_level: 'viewer' | 'commenter' | 'editor' | 'owner'
  inherited_from: string | null
  granted_by: string
  granted_at: string
}

export interface PublicLink {
  id: string
  link_token: string
  file_id: string | null
  folder_id: string | null
  permission_level: 'viewer' | 'editor'
  requires_password: boolean
  password_hash: string | null
  expires_at: string | null
  max_access_count: number | null
  current_access_count: number
  created_by: string
  created_at: string
}

export interface UploadProgress {
  fileId: string
  fileName: string
  progress: number
  status: 'queued' | 'uploading' | 'completed' | 'failed' | 'paused'
  error?: string
}

export type ViewMode = 'list' | 'grid'

export type SortField = 'name' | 'size' | 'created_at' | 'updated_at'
export type SortDirection = 'asc' | 'desc'
