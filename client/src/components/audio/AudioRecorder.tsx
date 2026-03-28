import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, Pause, Play, Trash2, Save, X } from 'lucide-react'
import AudioWaveform from './AudioWaveform'
import { supabase } from '../../lib/supabase'
import api from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'

interface AudioRecorderProps {
  onSave: (fileRecord: unknown) => void
  onClose: () => void
  folderId?: string | null
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped' | 'saving'

const MAX_DURATION_SECONDS = 7200 // 2 hours hard cap

export default function AudioRecorder({ onSave, onClose, folderId }: AudioRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Client-side chunk buffer — no server involved during recording
  const chunksRef = useRef<Blob[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeTypeRef = useRef<string>('audio/webm')

  const { user } = useAuth()

  useEffect(() => {
    const now = new Date()
    setFileName(
      `Recording_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
    )
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer()
      stopMicStream()
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [])

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const stopMicStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setAnalyserNode(null)
  }

  // Start recording — collect chunks in memory client-side
  const startRecording = useCallback(async () => {
    try {
      setError(null)
      chunksRef.current = []
      setUploadProgress(0)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      })
      streamRef.current = stream

      // Waveform analyser
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      setAnalyserNode(analyser)

      // Pick best mime type
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      const mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
      mimeTypeRef.current = mimeType || 'audio/webm'

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        audioBitsPerSecond: 128_000,
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        stopMicStream()
        if (audioContextRef.current) {
          audioContextRef.current.close()
          audioContextRef.current = null
        }
      }

      // Collect every second — small chunks so memory stays manageable
      mediaRecorder.start(1000)
      setRecordingState('recording')
      setDuration(0)

      timerRef.current = setInterval(() => {
        setDuration(d => {
          if (d + 1 >= MAX_DURATION_SECONDS) {
            stopRecordingNow()
            return d + 1
          }
          return d + 1
        })
      }, 1000)

    } catch (err) {
      console.error('[audio] Start error:', err)
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone access denied. Allow microphone access in browser settings.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to start recording.')
      }
      stopMicStream()
    }
  }, [])

  const stopRecordingNow = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')
    ) {
      mediaRecorderRef.current.stop()
    }
    stopTimer()
    setRecordingState('stopped')
  }, [])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      setRecordingState('paused')
      stopTimer()
    }
  }, [])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      setRecordingState('recording')
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    }
  }, [])

  const stopRecording = useCallback(() => {
    stopRecordingNow()
  }, [stopRecordingNow])

  const discardRecording = useCallback(() => {
    chunksRef.current = []
    setDuration(0)
    setUploadProgress(0)
    setRecordingState('idle')
  }, [])

  // Save: assemble Blob → upload directly to Supabase Storage → save DB record
  // Uses Supabase resumable upload so large files work reliably on Railway
  const saveRecording = useCallback(async () => {
    if (!fileName.trim() || chunksRef.current.length === 0 || !user) return
    setRecordingState('saving')
    setError(null)
    setUploadProgress(0)

    try {
      const mimeType = mimeTypeRef.current
      const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm'
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const name = fileName.trim().includes('.') ? fileName.trim() : `${fileName.trim()}.${ext}`
      const storagePath = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`

      setUploadProgress(10)

      // Upload directly to Supabase Storage (bypasses Railway server entirely)
      // Uses Supabase resumable (TUS) upload which handles large files reliably
      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(storagePath, blob, {
          contentType: mimeType,
          upsert: false,
          duplex: 'half',
        } as any)

      if (uploadError) throw uploadError

      setUploadProgress(80)

      // Save file record via server (auth + RLS-safe)
      const fileRecord = await api.createFileRecord({
        name,
        file_type: mimeType,
        file_extension: ext,
        size_bytes: blob.size,
        folder_id: folderId ?? null,
        storage_path: storagePath,
        bucket_name: 'files',
        upload_status: 'completed',
      })

      setUploadProgress(100)
      chunksRef.current = []
      onSave(fileRecord)
      onClose()
    } catch (err) {
      console.error('[audio] Save error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save recording')
      setRecordingState('stopped')
      setUploadProgress(0)
    }
  }, [fileName, folderId, user, onSave, onClose])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '2rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white', borderRadius: '12px',
          width: '100%', maxWidth: '500px',
          overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Record Audio</h2>
          <button onClick={onClose} style={{ padding: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          {/* Waveform */}
          <div style={{ height: '120px', backgroundColor: '#f9fafb', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {recordingState === 'idle' && (
              <div style={{ textAlign: 'center', color: '#6b7280' }}>
                <Mic size={32} style={{ marginBottom: '0.5rem' }} />
                <p style={{ margin: 0, fontSize: '0.875rem' }}>Click to start recording</p>
              </div>
            )}
            {(recordingState === 'recording' || recordingState === 'paused') && analyserNode && (
              <AudioWaveform analyser={analyserNode} isActive={recordingState === 'recording'} />
            )}
            {recordingState === 'stopped' && (
              <div style={{ textAlign: 'center', color: '#6b7280' }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>Recording complete — enter a name and save</p>
              </div>
            )}
            {recordingState === 'saving' && (
              <div style={{ textAlign: 'center', color: '#3b82f6', padding: '0 1rem', width: '100%' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem' }}>Uploading…</p>
                <div style={{ height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: '#3b82f6', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )}
          </div>

          {/* Timer */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: '700', fontFamily: 'monospace', color: recordingState === 'recording' ? '#ef4444' : '#111827' }}>
              {formatTime(duration)}
            </span>
            {recordingState === 'recording' && (
              <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '50%', marginLeft: '0.75rem', animation: 'pulse 1s ease-in-out infinite' }} />
            )}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            {recordingState === 'idle' && (
              <button onClick={startRecording} style={btnStyle('#ef4444', 64)}>
                <Mic size={28} />
              </button>
            )}
            {recordingState === 'recording' && (
              <>
                <button onClick={pauseRecording} style={btnStyle('#f59e0b', 56)}><Pause size={24} /></button>
                <button onClick={stopRecording} style={btnStyle('#ef4444', 56)}><Square size={24} /></button>
              </>
            )}
            {recordingState === 'paused' && (
              <>
                <button onClick={resumeRecording} style={btnStyle('#10b981', 56)}><Play size={24} /></button>
                <button onClick={stopRecording} style={btnStyle('#ef4444', 56)}><Square size={24} /></button>
              </>
            )}
            {recordingState === 'stopped' && (
              <>
                <button onClick={discardRecording} style={btnStyle('#f3f4f6', 56, '#6b7280')}><Trash2 size={24} /></button>
                <button onClick={startRecording} style={btnStyle('#ef4444', 56)}><Mic size={24} /></button>
              </>
            )}
          </div>

          {/* Save section */}
          {(recordingState === 'stopped' || recordingState === 'saving') && (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#374151' }}>
                File name
              </label>
              <input
                type="text"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                disabled={recordingState === 'saving'}
                style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1rem', boxSizing: 'border-box' }}
                placeholder="Enter file name"
              />
              <button
                onClick={saveRecording}
                disabled={!fileName.trim() || recordingState === 'saving'}
                style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: (!fileName.trim() || recordingState === 'saving') ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.875rem', fontWeight: '500', cursor: (!fileName.trim() || recordingState === 'saving') ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Save size={18} />
                {recordingState === 'saving' ? 'Uploading…' : 'Save Recording'}
              </button>
            </div>
          )}
        </div>

        <style>{`
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        `}</style>
      </div>
    </div>
  )
}

function btnStyle(bg: string, size: number, color = 'white'): React.CSSProperties {
  return {
    width: `${size}px`, height: `${size}px`, borderRadius: '50%',
    backgroundColor: bg, color, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: bg !== '#f3f4f6' ? `0 4px 6px ${bg}55` : undefined,
  }
}
