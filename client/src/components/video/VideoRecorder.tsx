import { useState, useRef, useCallback, useEffect } from 'react'
import { Video, Square, Pause, Play, Trash2, Save, X, Camera, Monitor, SwitchCamera } from 'lucide-react'

interface VideoRecorderProps {
  onSave: (videoBlob: Blob, fileName: string) => Promise<void>
  onClose: () => void
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped'
type SourceType = 'camera' | 'screen'

export default function VideoRecorder({ onSave, onClose }: VideoRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [fileName, setFileName] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('camera')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null)
  const playbackVideoRef = useRef<HTMLVideoElement | null>(null)

  // Check for multiple cameras
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoInputs = devices.filter(d => d.kind === 'videoinput')
      setHasMultipleCameras(videoInputs.length > 1)
    }).catch(() => {
      // Ignore errors
    })
  }, [])

  // Generate default filename
  useEffect(() => {
    const now = new Date()
    const defaultName = `Video_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`
    setFileName(defaultName)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }
    }
  }, [videoUrl])

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      chunksRef.current = []

      let stream: MediaStream

      if (sourceType === 'screen') {
        // Screen capture with system audio
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true
        })

        // Also capture microphone audio
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true
            }
          })
          // Merge audio tracks
          audioStream.getAudioTracks().forEach(track => stream.addTrack(track))
        } catch (audioErr) {
          console.log('Could not capture microphone audio:', audioErr)
        }
      } else {
        // Camera capture
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
            facingMode: facingMode
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          }
        })
      }

      streamRef.current = stream

      // Show preview - ensure video element is ready
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream
        videoPreviewRef.current.muted = true
        videoPreviewRef.current.playsInline = true
        await videoPreviewRef.current.play().catch(err => {
          console.warn('Preview play failed:', err)
        })
      }

      // Handle screen share ending
      if (sourceType === 'screen') {
        stream.getVideoTracks()[0].onended = () => {
          if (recordingState === 'recording' || recordingState === 'paused') {
            stopRecording()
          }
        }
      }

      // Determine best supported format
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ]
      let mimeType = ''
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type
          break
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size)
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, chunks:', chunksRef.current.length)
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' })
        console.log('Created blob:', blob.size, 'bytes')
        setVideoBlob(blob)
        const url = URL.createObjectURL(blob)
        setVideoUrl(url)
        setRecordingState('stopped')

        // Stop preview
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null
        }
      }

      // Request data periodically to ensure we capture everything
      mediaRecorder.start(100) // Collect data every 100ms for smoother capture
      setRecordingState('recording')
      setDuration(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1)
      }, 1000)

    } catch (err) {
      console.error('Error starting recording:', err)
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setError(`${sourceType === 'screen' ? 'Screen sharing' : 'Camera'} access denied. Please allow access in your browser settings.`)
        } else if (err.name === 'NotFoundError') {
          setError('No camera found. Please connect a camera and try again.')
        } else {
          setError(`Failed to start recording: ${err.message}`)
        }
      } else {
        setError('Failed to start recording. Please check your camera/microphone.')
      }
    }
  }, [sourceType, facingMode])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause()
      setRecordingState('paused')
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [recordingState])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume()
      setRecordingState('recording')
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1)
      }, 1000)
    }
  }, [recordingState])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && (recordingState === 'recording' || recordingState === 'paused')) {
      mediaRecorderRef.current.stop()
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [recordingState])

  const discardRecording = useCallback(() => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
    }
    setVideoUrl(null)
    setVideoBlob(null)
    setDuration(0)
    setRecordingState('idle')
  }, [videoUrl])

  const saveRecording = useCallback(async () => {
    if (!videoBlob || !fileName.trim()) return

    setSaving(true)
    try {
      const finalFileName = fileName.endsWith('.webm') ? fileName : `${fileName}.webm`
      await onSave(videoBlob, finalFileName)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recording')
    } finally {
      setSaving(false)
    }
  }, [videoBlob, fileName, onSave, onClose])

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }, [])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Video size={24} />
            Record Video
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          {/* Source Selection (only in idle state) */}
          {recordingState === 'idle' && (
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}>
              <button
                onClick={() => setSourceType('camera')}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  backgroundColor: sourceType === 'camera' ? '#3b82f6' : '#f3f4f6',
                  color: sourceType === 'camera' ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontWeight: '500',
                }}
              >
                <Camera size={20} />
                Camera
              </button>
              <button
                onClick={() => setSourceType('screen')}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  backgroundColor: sourceType === 'screen' ? '#3b82f6' : '#f3f4f6',
                  color: sourceType === 'screen' ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontWeight: '500',
                }}
              >
                <Monitor size={20} />
                Screen
              </button>
            </div>
          )}

          {/* Video Preview/Playback Area */}
          <div style={{
            position: 'relative',
            backgroundColor: '#000',
            borderRadius: '8px',
            marginBottom: '1rem',
            overflow: 'hidden',
            aspectRatio: '16/9',
          }}>
            {recordingState === 'idle' && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
              }}>
                {sourceType === 'camera' ? <Camera size={48} /> : <Monitor size={48} />}
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem' }}>
                  Click record to start {sourceType === 'screen' ? 'screen recording' : 'camera recording'}
                </p>
              </div>
            )}

            {(recordingState === 'recording' || recordingState === 'paused') && (
              <>
                <video
                  ref={videoPreviewRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                  autoPlay
                  muted
                  playsInline
                />
                {/* Recording indicator */}
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: recordingState === 'recording' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(245, 158, 11, 0.9)',
                  color: 'white',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    animation: recordingState === 'recording' ? 'pulse 1s ease-in-out infinite' : 'none',
                  }} />
                  {recordingState === 'recording' ? 'REC' : 'PAUSED'}
                </div>
                {/* Timer overlay */}
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontFamily: 'monospace',
                  fontWeight: '600',
                }}>
                  {formatTime(duration)}
                </div>
                {/* Camera switch button (only for camera mode with multiple cameras) */}
                {sourceType === 'camera' && hasMultipleCameras && (
                  <button
                    onClick={toggleCamera}
                    style={{
                      position: 'absolute',
                      bottom: '1rem',
                      right: '1rem',
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <SwitchCamera size={20} />
                  </button>
                )}
              </>
            )}

            {recordingState === 'stopped' && videoUrl && (
              <video
                ref={playbackVideoRef}
                src={videoUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
                controls
                playsInline
                onLoadedMetadata={(e) => {
                  console.log('Playback video loaded, duration:', e.currentTarget.duration)
                }}
                onError={(e) => {
                  console.error('Playback video error:', e)
                }}
              />
            )}
          </div>

          {/* File size indicator */}
          {videoBlob && (
            <div style={{
              textAlign: 'center',
              marginBottom: '1rem',
              color: '#6b7280',
              fontSize: '0.875rem',
            }}>
              File size: {formatFileSize(videoBlob.size)} | Duration: {formatTime(duration)}
            </div>
          )}

          {/* Controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}>
            {recordingState === 'idle' && (
              <button
                onClick={startRecording}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 6px rgba(239, 68, 68, 0.3)',
                }}
              >
                <Video size={28} />
              </button>
            )}

            {recordingState === 'recording' && (
              <>
                <button
                  onClick={pauseRecording}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Pause"
                >
                  <Pause size={24} />
                </button>
                <button
                  onClick={stopRecording}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Stop"
                >
                  <Square size={24} />
                </button>
              </>
            )}

            {recordingState === 'paused' && (
              <>
                <button
                  onClick={resumeRecording}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Resume"
                >
                  <Play size={24} />
                </button>
                <button
                  onClick={stopRecording}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Stop"
                >
                  <Square size={24} />
                </button>
              </>
            )}

            {recordingState === 'stopped' && (
              <>
                <button
                  onClick={discardRecording}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Discard"
                >
                  <Trash2 size={24} />
                </button>
                <button
                  onClick={startRecording}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Record Again"
                >
                  <Video size={24} />
                </button>
              </>
            )}
          </div>

          {/* Save section (only when stopped) */}
          {recordingState === 'stopped' && videoBlob && (
            <div style={{
              borderTop: '1px solid #e5e7eb',
              paddingTop: '1.5rem',
            }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                marginBottom: '0.5rem',
                color: '#374151',
              }}>
                File name
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                  boxSizing: 'border-box',
                }}
                placeholder="Enter file name"
              />
              <button
                onClick={saveRecording}
                disabled={saving || !fileName.trim()}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: saving ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Recording'}
              </button>
            </div>
          )}
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    </div>
  )
}
