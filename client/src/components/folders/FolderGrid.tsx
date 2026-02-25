import { Folder as FolderIcon, MoreVertical, Info, PenTool } from 'lucide-react'
import { Folder, File as FileType, ViewMode } from '../../types/files'
import { formatFileSize } from '../../lib/supabase'
import FileThumbnail from '../files/FileThumbnail'

interface FolderGridProps {
  folders: Folder[]
  files: FileType[]
  onFolderClick: (folder: Folder) => void
  onFileClick: (file: FileType) => void
  onFolderAction?: (folder: Folder, action: string) => void
  onFileAction?: (file: FileType, action: string) => void
  viewMode?: ViewMode
}

export default function FolderGrid({
  folders,
  files,
  onFolderClick,
  onFileClick,
  onFolderAction,
  onFileAction,
  viewMode = 'grid',
}: FolderGridProps) {
  // List View
  if (viewMode === 'list') {
    return (
      <div style={{ padding: '0.5rem' }}>
        {/* List Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 120px 150px 100px',
          gap: '1rem',
          padding: '0.75rem 1rem',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          fontSize: '0.75rem',
          fontWeight: '600',
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          <span>Name</span>
          <span>Size</span>
          <span>Modified</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        {/* Folders in List */}
        {folders.map((folder) => (
          <div
            key={folder.id}
            onClick={() => onFolderClick(folder)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 150px 100px',
              gap: '1rem',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #f3f4f6',
              cursor: 'pointer',
              alignItems: 'center',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <FolderIcon size={20} style={{ color: folder.color || '#3b82f6', flexShrink: 0 }} />
              <span style={{
                fontWeight: '500',
                fontSize: '0.875rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {folder.name}
              </span>
            </div>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>—</span>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {folder.updated_at ? new Date(folder.updated_at).toLocaleDateString() : '—'}
            </span>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {onFolderAction && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onFolderAction(folder, 'menu')
                  }}
                  style={{
                    padding: '0.25rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: '4px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e5e7eb'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <MoreVertical size={16} />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Files in List */}
        {files.map((file) => (
          <div
            key={file.id}
            onClick={() => onFileClick(file)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 150px 100px',
              gap: '1rem',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #f3f4f6',
              cursor: 'pointer',
              alignItems: 'center',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <FileThumbnail file={file} size="small" />
              <span style={{
                fontWeight: '500',
                fontSize: '0.875rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {file.name}
              </span>
            </div>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {formatFileSize(file.size_bytes)}
            </span>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {file.updated_at ? new Date(file.updated_at).toLocaleDateString() : '—'}
            </span>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
              {onFileAction && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onFileAction(file, 'details')
                    }}
                    style={{
                      padding: '0.25rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      color: '#6b7280',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#dbeafe'
                      e.currentTarget.style.color = '#3b82f6'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = '#6b7280'
                    }}
                    title="File details & sharing"
                  >
                    <Info size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onFileAction(file, 'esignature')
                    }}
                    style={{
                      padding: '0.25rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      color: '#6b7280',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#ede9fe'
                      e.currentTarget.style.color = '#8b5cf6'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = '#6b7280'
                    }}
                    title="E-Signatures"
                  >
                    <PenTool size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onFileAction(file, 'menu')
                    }}
                    style={{
                      padding: '0.25rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e5e7eb'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                    title="Delete"
                  >
                    <MoreVertical size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {folders.length === 0 && files.length === 0 && (
          <div style={{
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

  // Grid View (default)
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
            <div style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              display: 'flex',
              gap: '0.25rem',
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onFileAction(file, 'details')
                }}
                style={{
                  padding: '0.25rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  color: '#6b7280',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#dbeafe'
                  e.currentTarget.style.color = '#3b82f6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#6b7280'
                }}
                title="File details & sharing"
              >
                <Info size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onFileAction(file, 'esignature')
                }}
                style={{
                  padding: '0.25rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  color: '#6b7280',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#ede9fe'
                  e.currentTarget.style.color = '#8b5cf6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#6b7280'
                }}
                title="E-Signatures"
              >
                <PenTool size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onFileAction(file, 'menu')
                }}
                style={{
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
                title="Delete"
              >
                <MoreVertical size={16} />
              </button>
            </div>
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
