import { X, Pause, Play, RotateCcw, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useUpload, UploadItem } from '../../contexts/UploadContext'
import { formatFileSize } from '../../lib/supabase'

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const k = 1024
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
  return `${(bytesPerSecond / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

function formatTimeRemaining(bytesRemaining: number, speed: number): string {
  if (speed === 0) return 'Calculating...'
  const seconds = bytesRemaining / speed
  if (seconds < 60) return `${Math.ceil(seconds)}s remaining`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m remaining`
  return `${Math.ceil(seconds / 3600)}h remaining`
}

interface UploadItemRowProps {
  upload: UploadItem
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onRetry: (id: string) => void
}

function UploadItemRow({ upload, onPause, onResume, onCancel, onRetry }: UploadItemRowProps) {
  const bytesRemaining = upload.totalSize - upload.uploadedSize
  const timeRemaining = upload.speed ? formatTimeRemaining(bytesRemaining, upload.speed) : ''

  return (
    <div style={{
      padding: '0.75rem 1rem',
      borderBottom: '1px solid #f3f4f6',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontWeight: '500',
            fontSize: '0.875rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {upload.fileName}
          </p>
          <p style={{
            margin: '0.25rem 0 0 0',
            fontSize: '0.75rem',
            color: '#6b7280',
          }}>
            {formatFileSize(upload.uploadedSize)} / {formatFileSize(upload.totalSize)}
            {upload.status === 'uploading' && upload.speed && upload.speed > 0 && (
              <> • {formatSpeed(upload.speed)} • {timeRemaining}</>
            )}
            {upload.totalChunks > 1 && (
              <> • Chunk {upload.chunksUploaded}/{upload.totalChunks}</>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
          {upload.status === 'uploading' && (
            <button
              onClick={() => onPause(upload.id)}
              style={{
                padding: '0.25rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px',
                color: '#6b7280',
              }}
              title="Pause"
            >
              <Pause size={16} />
            </button>
          )}

          {upload.status === 'paused' && (
            <button
              onClick={() => onResume(upload.id)}
              style={{
                padding: '0.25rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px',
                color: '#3b82f6',
              }}
              title="Resume"
            >
              <Play size={16} />
            </button>
          )}

          {upload.status === 'failed' && (
            <button
              onClick={() => onRetry(upload.id)}
              style={{
                padding: '0.25rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px',
                color: '#f59e0b',
              }}
              title="Retry"
            >
              <RotateCcw size={16} />
            </button>
          )}

          {(upload.status === 'uploading' || upload.status === 'paused' || upload.status === 'queued') && (
            <button
              onClick={() => onCancel(upload.id)}
              style={{
                padding: '0.25rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px',
                color: '#ef4444',
              }}
              title="Cancel"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '4px',
        backgroundColor: '#e5e7eb',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${upload.progress}%`,
          height: '100%',
          backgroundColor:
            upload.status === 'completed' ? '#10b981' :
            upload.status === 'failed' ? '#ef4444' :
            upload.status === 'paused' ? '#f59e0b' :
            '#3b82f6',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Status indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        fontSize: '0.75rem',
      }}>
        {upload.status === 'uploading' && (
          <>
            <Loader2 size={12} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: '#3b82f6' }}>Uploading... {upload.progress}%</span>
          </>
        )}
        {upload.status === 'queued' && (
          <span style={{ color: '#6b7280' }}>Queued</span>
        )}
        {upload.status === 'paused' && (
          <span style={{ color: '#f59e0b' }}>Paused</span>
        )}
        {upload.status === 'completed' && (
          <>
            <CheckCircle size={12} style={{ color: '#10b981' }} />
            <span style={{ color: '#10b981' }}>Completed</span>
          </>
        )}
        {upload.status === 'failed' && (
          <>
            <AlertCircle size={12} style={{ color: '#ef4444' }} />
            <span style={{ color: '#ef4444' }}>{upload.error || 'Failed'}</span>
          </>
        )}
      </div>
    </div>
  )
}

export default function UploadManager() {
  const { uploads, pauseUpload, resumeUpload, cancelUpload, retryUpload, clearCompleted, totalProgress, isUploading } = useUpload()
  const [isExpanded, setIsExpanded] = useState(true)

  if (uploads.length === 0) return null

  const completedCount = uploads.filter(u => u.status === 'completed').length
  const failedCount = uploads.filter(u => u.status === 'failed').length
  const activeCount = uploads.filter(u => u.status === 'uploading' || u.status === 'queued').length

  return (
    <div style={{
      position: 'fixed',
      bottom: '1rem',
      right: '1rem',
      width: '380px',
      maxHeight: '400px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div
        style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isUploading && (
            <Loader2 size={16} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
          )}
          <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>
            {isUploading ? `Uploading... ${totalProgress}%` : `${uploads.length} Upload${uploads.length !== 1 ? 's' : ''}`}
          </span>
          {completedCount > 0 && (
            <span style={{
              fontSize: '0.75rem',
              backgroundColor: '#dcfce7',
              color: '#166534',
              padding: '0.125rem 0.375rem',
              borderRadius: '9999px',
            }}>
              {completedCount} done
            </span>
          )}
          {failedCount > 0 && (
            <span style={{
              fontSize: '0.75rem',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              padding: '0.125rem 0.375rem',
              borderRadius: '9999px',
            }}>
              {failedCount} failed
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {completedCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearCompleted()
              }}
              style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Clear done
            </button>
          )}
          {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </div>
      </div>

      {/* Overall progress */}
      {isUploading && (
        <div style={{
          height: '3px',
          backgroundColor: '#e5e7eb',
        }}>
          <div style={{
            width: `${totalProgress}%`,
            height: '100%',
            backgroundColor: '#3b82f6',
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {/* Upload list */}
      {isExpanded && (
        <div style={{
          flex: 1,
          overflow: 'auto',
          maxHeight: '300px',
        }}>
          {uploads.map(upload => (
            <UploadItemRow
              key={upload.id}
              upload={upload}
              onPause={pauseUpload}
              onResume={resumeUpload}
              onCancel={cancelUpload}
              onRetry={retryUpload}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
