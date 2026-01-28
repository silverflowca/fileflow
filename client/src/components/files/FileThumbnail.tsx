import { useState, useEffect } from 'react'
import { File as FileType } from '../../types/files'
import { getFileUrl, getFileIcon } from '../../lib/fileUtils'
import { Play } from 'lucide-react'

interface FileThumbnailProps {
  file: FileType
  size?: 'small' | 'medium' | 'large'
  showDuration?: boolean
  onClick?: () => void
}

const sizeMap = {
  small: { width: 48, height: 48, iconSize: 24 },
  medium: { width: 120, height: 120, iconSize: 40 },
  large: { width: 200, height: 200, iconSize: 64 },
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `0:${seconds.toString().padStart(2, '0')}`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return `${mins}:${secs.toString().padStart(2, '0')}`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default function FileThumbnail({
  file,
  size = 'medium',
  showDuration = true,
  onClick,
}: FileThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const { width, height, iconSize } = sizeMap[size]
  const isVideo = file.file_type.startsWith('video/')
  const isAudio = file.file_type.startsWith('audio/')
  const isImage = file.file_type.startsWith('image/')
  const hasThumbnail = !!file.thumbnail_path

  useEffect(() => {
    if (hasThumbnail) {
      loadThumbnail()
    }
  }, [file.thumbnail_path])

  const loadThumbnail = async () => {
    if (!file.thumbnail_path) return

    setLoading(true)
    setError(false)

    try {
      const url = await getFileUrl(file.thumbnail_path, file.bucket_name)
      setThumbnailUrl(url)
    } catch (err) {
      console.error('Error loading thumbnail:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    width,
    height,
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    cursor: onClick ? 'pointer' : 'default',
    flexShrink: 0,
  }

  // Show thumbnail if available
  if (hasThumbnail && thumbnailUrl && !error) {
    return (
      <div style={containerStyle} onClick={onClick}>
        <img
          src={thumbnailUrl}
          alt={file.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Video play icon overlay */}
        {isVideo && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '50%',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Play size={20} style={{ color: 'white', marginLeft: 2 }} />
          </div>
        )}

        {/* Duration badge */}
        {showDuration && file.duration_seconds && (
          <div style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            fontSize: '0.65rem',
            padding: '2px 4px',
            borderRadius: '3px',
            fontWeight: '500',
          }}>
            {formatDuration(file.duration_seconds)}
          </div>
        )}

        {/* Dimensions badge for images */}
        {isImage && file.dimensions && size === 'large' && (
          <div style={{
            position: 'absolute',
            bottom: 4,
            left: 4,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            fontSize: '0.65rem',
            padding: '2px 4px',
            borderRadius: '3px',
            fontWeight: '500',
          }}>
            {file.dimensions.width}x{file.dimensions.height}
          </div>
        )}
      </div>
    )
  }

  // Show loading state
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{
          width: 24,
          height: 24,
          border: '2px solid #e5e7eb',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // Fallback to emoji icon
  return (
    <div style={containerStyle} onClick={onClick}>
      <span style={{ fontSize: iconSize }}>{getFileIcon(file.file_type)}</span>

      {/* Duration badge for audio */}
      {showDuration && isAudio && file.duration_seconds && (
        <div style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          fontSize: '0.65rem',
          padding: '2px 4px',
          borderRadius: '3px',
          fontWeight: '500',
        }}>
          {formatDuration(file.duration_seconds)}
        </div>
      )}
    </div>
  )
}
