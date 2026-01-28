import { Folder as FolderIcon, MoreVertical } from 'lucide-react'
import { Folder, File as FileType } from '../../types/files'
import { formatFileSize } from '../../lib/supabase'
import FileThumbnail from '../files/FileThumbnail'

interface FolderGridProps {
  folders: Folder[]
  files: FileType[]
  onFolderClick: (folder: Folder) => void
  onFileClick: (file: FileType) => void
  onFolderAction?: (folder: Folder, action: string) => void
  onFileAction?: (file: FileType, action: string) => void
}

export default function FolderGrid({
  folders,
  files,
  onFolderClick,
  onFileClick,
  onFolderAction,
  onFileAction,
}: FolderGridProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '1rem',
      padding: '1rem'
    }}>
      {/* Folders */}
      {folders.map((folder) => (
        <div
          key={folder.id}
          onClick={() => onFolderClick(folder)}
          style={{
            padding: '1.5rem 1rem',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6'
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e5e7eb'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <FolderIcon
              size={48}
              style={{ color: folder.color || '#3b82f6' }}
            />
            <p style={{
              fontWeight: '500',
              fontSize: '0.875rem',
              textAlign: 'center',
              wordBreak: 'break-word',
              margin: 0
            }}>
              {folder.name}
            </p>
          </div>
          {onFolderAction && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onFolderAction(folder, 'menu')
              }}
              style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                padding: '0.25rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <MoreVertical size={16} />
            </button>
          )}
        </div>
      ))}

      {/* Files */}
      {files.map((file) => (
        <div
          key={file.id}
          onClick={() => onFileClick(file)}
          style={{
            padding: '1.5rem 1rem',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6'
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e5e7eb'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <FileThumbnail file={file} size="medium" />
            <div style={{ textAlign: 'center', width: '100%' }}>
              <p style={{
                fontWeight: '500',
                fontSize: '0.875rem',
                wordBreak: 'break-word',
                margin: '0 0 0.25rem 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {file.name}
              </p>
              <p style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                margin: 0
              }}>
                {formatFileSize(file.size_bytes)}
              </p>
            </div>
          </div>
          {onFileAction && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onFileAction(file, 'menu')
              }}
              style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                padding: '0.25rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <MoreVertical size={16} />
            </button>
          )}
        </div>
      ))}

      {folders.length === 0 && files.length === 0 && (
        <div style={{
          gridColumn: '1 / -1',
          textAlign: 'center',
          padding: '3rem',
          color: '#6b7280'
        }}>
          <p>This folder is empty</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Upload files or create folders to get started
          </p>
        </div>
      )}
    </div>
  )
}
