import { useEffect, useState, useRef } from 'react'
import { X, Download, Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward } from 'lucide-react'
import { File as FileType } from '../../types/files'
import { getFileUrl, isPreviewable } from '../../lib/fileUtils'
import { formatFileSize } from '../../lib/supabase'

interface FilePreviewModalProps {
  file: FileType | null
  isOpen: boolean
  onClose: () => void
  onDownload: (file: FileType) => void
}

export default function FilePreviewModal({
  file,
  isOpen,
  onClose,
  onDownload,
}: FilePreviewModalProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mediaLoading, setMediaLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (isOpen && file && isPreviewable(file.file_type)) {
      loadFileUrl()
      setMediaLoading(true)
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
    } else {
      setFileUrl(null)
    }
  }, [isOpen, file])

  const loadFileUrl = async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const url = await getFileUrl(file.storage_path, file.bucket_name)
      setFileUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handlePlayPause = () => {
    const media = videoRef.current || audioRef.current
    if (media) {
      if (isPlaying) {
        media.pause()
      } else {
        media.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleMuteToggle = () => {
    const media = videoRef.current || audioRef.current
    if (media) {
      media.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const media = videoRef.current || audioRef.current
    if (media) {
      const time = parseFloat(e.target.value)
      media.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleSkip = (seconds: number) => {
    const media = videoRef.current || audioRef.current
    if (media) {
      media.currentTime = Math.max(0, Math.min(duration, media.currentTime + seconds))
    }
  }

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        videoRef.current.requestFullscreen()
      }
    }
  }

  if (!isOpen || !file) return null

  const canPreview = isPreviewable(file.file_type)
  const isVideo = file.file_type.startsWith('video/')
  const isAudio = file.file_type.startsWith('audio/')

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '1200px',
          height: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
              {file.name}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
              {formatFileSize(file.size_bytes)} • {file.file_type}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => onDownload(file)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              <Download size={16} />
              Download
            </button>
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '6px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '1rem',
          backgroundColor: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
        }}>
          {loading && (
            <p style={{ color: '#6b7280' }}>Loading preview...</p>
          )}

          {error && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>
              <button
                onClick={loadFileUrl}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && !canPreview && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>📄</p>
              <p style={{ color: '#6b7280' }}>Preview not available for this file type</p>
              <button
                onClick={() => onDownload(file)}
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Download File
              </button>
            </div>
          )}

          {!loading && !error && canPreview && fileUrl && (
            <>
              {file.file_type.startsWith('image/') && (
                <img
                  src={fileUrl}
                  alt={file.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                />
              )}

              {isVideo && (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}>
                  {mediaLoading && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: 'white',
                      fontSize: '1rem',
                    }}>
                      Loading video...
                    </div>
                  )}
                  <video
                    ref={videoRef}
                    src={fileUrl}
                    style={{
                      flex: 1,
                      width: '100%',
                      maxHeight: 'calc(90vh - 180px)',
                      objectFit: 'contain',
                    }}
                    onLoadedMetadata={(e) => {
                      setDuration(e.currentTarget.duration)
                      setMediaLoading(false)
                    }}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onClick={handlePlayPause}
                  />
                  {/* Custom Video Controls */}
                  <div style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}>
                    {/* Progress bar */}
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      style={{
                        width: '100%',
                        height: '6px',
                        cursor: 'pointer',
                        accentColor: '#3b82f6',
                      }}
                    />
                    {/* Controls row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button onClick={() => handleSkip(-10)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0.25rem' }}>
                          <SkipBack size={20} />
                        </button>
                        <button onClick={handlePlayPause} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0.25rem' }}>
                          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                        </button>
                        <button onClick={() => handleSkip(10)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0.25rem' }}>
                          <SkipForward size={20} />
                        </button>
                        <button onClick={handleMuteToggle} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0.25rem' }}>
                          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                        <span style={{ color: 'white', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>
                      <button onClick={handleFullscreen} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0.25rem' }}>
                        <Maximize size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isAudio && (
                <div style={{
                  width: '100%',
                  maxWidth: '600px',
                  padding: '2rem',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                }}>
                  {/* Audio visualization placeholder */}
                  <div style={{
                    width: '100%',
                    height: '120px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1.5rem',
                    fontSize: '4rem',
                  }}>
                    🎵
                  </div>

                  {/* Hidden audio element for streaming */}
                  <audio
                    ref={audioRef}
                    src={fileUrl}
                    preload="metadata"
                    onLoadedMetadata={(e) => {
                      setDuration(e.currentTarget.duration)
                      setMediaLoading(false)
                    }}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    style={{ display: 'none' }}
                  />

                  {/* Progress bar */}
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    style={{
                      width: '100%',
                      height: '8px',
                      cursor: 'pointer',
                      accentColor: '#3b82f6',
                      marginBottom: '0.5rem',
                    }}
                  />

                  {/* Time display */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginBottom: '1rem',
                    fontFamily: 'monospace',
                  }}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>

                  {/* Controls */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                  }}>
                    <button
                      onClick={() => handleSkip(-10)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        borderRadius: '50%',
                      }}
                    >
                      <SkipBack size={24} />
                    </button>
                    <button
                      onClick={handlePlayPause}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: '#3b82f6',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isPlaying ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: '3px' }} />}
                    </button>
                    <button
                      onClick={() => handleSkip(10)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        borderRadius: '50%',
                      }}
                    >
                      <SkipForward size={24} />
                    </button>
                    <button
                      onClick={handleMuteToggle}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        marginLeft: '1rem',
                      }}
                    >
                      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                  </div>

                  {mediaLoading && (
                    <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '1rem', fontSize: '0.875rem' }}>
                      Loading audio...
                    </p>
                  )}
                </div>
              )}

              {file.file_type.includes('pdf') && (
                <iframe
                  src={fileUrl}
                  title={file.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: '70vh',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
