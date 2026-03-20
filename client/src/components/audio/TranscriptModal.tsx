import { useState, useCallback, useEffect } from 'react'
import { X, FileText, Sparkles, Copy, Check, Loader } from 'lucide-react'
import { api } from '../../lib/api'
import type { File as FileType } from '../../types/files'

interface TranscriptModalProps {
  file: FileType
  onClose: () => void
  autoStart?: boolean
}

type Tab = 'transcript' | 'summary'

const API_BASE = import.meta.env.VITE_API_URL || ''

function authHeaders() {
  return { Authorization: `Bearer ${api.getToken() ?? ''}` }
}

export default function TranscriptModal({ file, onClose, autoStart = false }: TranscriptModalProps) {
  const [tab, setTab] = useState<Tab>('transcript')
  const [transcript, setTranscript] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const requestTranscript = useCallback(async () => {
    setTranscribing(true)
    setError(null)
    try {
      // Try GET first (cached)
      let res = await fetch(`${API_BASE}/api/audio/transcribe/${file.id}`, {
        headers: authHeaders(),
      })
      if (res.status === 404) {
        // Not cached — POST to transcribe
        res = await fetch(`${API_BASE}/api/audio/transcribe/${file.id}`, {
          method: 'POST',
          headers: authHeaders(),
        })
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Transcription failed')
      }
      const data = await res.json()
      setTranscript(data.paragraphs ?? data.transcript ?? '')
      if (data.summary) setSummary(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed')
    } finally {
      setTranscribing(false)
    }
  }, [file.id])

  const requestSummary = useCallback(async () => {
    setSummarizing(true)
    setError(null)
    setTab('summary')
    try {
      const res = await fetch(`${API_BASE}/api/audio/summarize/${file.id}`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Summary failed')
      }
      const data = await res.json()
      setSummary(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Summary failed')
    } finally {
      setSummarizing(false)
    }
  }, [file.id])

  useEffect(() => {
    if (autoStart) requestTranscript()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const copyText = useCallback(() => {
    const text = tab === 'transcript' ? transcript : summary
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [tab, transcript, summary])

  const activeText = tab === 'transcript' ? transcript : summary

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1.5rem' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>Transcript</h2>
            <p style={{ margin: '0.125rem 0 0', fontSize: '0.8rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>{file.name}</p>
          </div>
          <button onClick={onClose} style={{ padding: '0.4rem', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          {(['transcript', 'summary'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '0.75rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: tab === t ? '600' : '400',
                color: tab === t ? '#3b82f6' : '#6b7280',
                borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                textTransform: 'capitalize',
              }}
            >
              {t === 'transcript' ? <FileText size={15} /> : <Sparkles size={15} />}
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem 1.5rem' }}>
          {error && (
            <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          {/* Transcript tab */}
          {tab === 'transcript' && (
            <>
              {transcript === null && !transcribing && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <FileText size={40} style={{ color: '#9ca3af', marginBottom: '1rem' }} />
                  <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>No transcript yet. Click below to transcribe this audio file using Deepgram.</p>
                  <button onClick={requestTranscript} style={primaryBtn}>
                    <FileText size={16} /> Transcribe Audio
                  </button>
                </div>
              )}
              {transcribing && <LoadingState label="Transcribing audio…" sub="This may take a moment for long recordings." />}
              {transcript !== null && !transcribing && (
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.875rem', lineHeight: '1.7', color: '#111827', margin: 0 }}>
                  {transcript || <span style={{ color: '#9ca3af' }}>No speech detected in this recording.</span>}
                </pre>
              )}
            </>
          )}

          {/* Summary tab */}
          {tab === 'summary' && (
            <>
              {summary === null && !summarizing && transcript === null && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <Sparkles size={40} style={{ color: '#9ca3af', marginBottom: '1rem' }} />
                  <p style={{ color: '#6b7280', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Transcribe the audio first, then generate an AI summary.</p>
                  <button onClick={() => { setTab('transcript'); requestTranscript() }} style={primaryBtn}>
                    <FileText size={16} /> Transcribe First
                  </button>
                </div>
              )}
              {summary === null && !summarizing && transcript !== null && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <Sparkles size={40} style={{ color: '#9ca3af', marginBottom: '1rem' }} />
                  <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Transcript is ready. Generate an AI summary now.</p>
                  <button onClick={requestSummary} style={primaryBtn}>
                    <Sparkles size={16} /> Generate Summary
                  </button>
                </div>
              )}
              {summarizing && <LoadingState label="Generating AI summary…" sub="Claude is analyzing the transcript." />}
              {summary !== null && !summarizing && (
                <div style={{ fontSize: '0.875rem', lineHeight: '1.75', color: '#111827', whiteSpace: 'pre-wrap' }}>
                  {summary}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.875rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {transcript !== null && tab === 'transcript' && (
              <button onClick={requestSummary} disabled={summarizing} style={secondaryBtn}>
                <Sparkles size={15} />
                {summarizing ? 'Summarizing…' : 'Summarize with AI'}
              </button>
            )}
            {tab === 'transcript' && transcript === null && !transcribing && (
              <button onClick={requestTranscript} style={secondaryBtn}>
                <FileText size={15} /> Transcribe
              </button>
            )}
          </div>
          {activeText && (
            <button onClick={copyText} style={secondaryBtn}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingState({ label, sub }: { label: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <Loader size={36} style={{ color: '#3b82f6', marginBottom: '1rem', animation: 'spin 1s linear infinite' }} />
      <p style={{ margin: 0, fontWeight: '500', color: '#111827' }}>{label}</p>
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>{sub}</p>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
  padding: '0.6rem 1.25rem', backgroundColor: '#3b82f6', color: 'white',
  border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500',
}

const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.5rem 1rem', backgroundColor: 'white', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem',
}
