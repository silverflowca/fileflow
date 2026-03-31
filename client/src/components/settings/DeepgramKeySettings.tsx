import { useState, useEffect } from 'react'
import { Mic, Check, X, Eye, EyeOff } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8680'

function getToken(): string | null {
  return localStorage.getItem('fileflow_token')
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export default function DeepgramKeySettings() {
  const [key, setKey] = useState('')
  const [preview, setPreview] = useState('')
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    request<{ configured: boolean; preview: string }>('/api/settings/deepgram-key')
      .then(data => { setConfigured(data.configured); setPreview(data.preview) })
      .catch(err => setMessage({ type: 'error', text: err.message }))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (!key.trim()) return
    setSaving(true)
    setMessage(null)
    try {
      await request('/api/settings/deepgram-key', {
        method: 'POST',
        body: JSON.stringify({ key }),
      })
      setConfigured(true)
      setPreview(key.slice(0, 6) + '…')
      setKey('')
      setShowKey(false)
      setMessage({ type: 'success', text: 'Deepgram API key saved.' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '640px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Mic size={18} color="#6366f1" />
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Deepgram API Key</h3>
      </div>
      <p style={{ margin: '0 0 1rem', fontSize: '0.825rem', color: '#6b7280' }}>
        Used for audio transcription. Falls back to the <code>DEEPGRAM_API_KEY</code> environment variable if not set here.
      </p>

      {loading ? (
        <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading…</div>
      ) : (
        <>
          {configured && !key && (
            <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
              Current key: <span style={{ fontFamily: 'monospace', color: '#6366f1' }}>{preview}</span>
              <span style={{ marginLeft: '0.5rem', color: '#16a34a', fontSize: '0.75rem' }}>● configured</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder={configured ? 'Enter new key to replace…' : 'Enter Deepgram API key…'}
                style={{
                  width: '100%', padding: '0.5rem 2.25rem 0.5rem 0.75rem',
                  border: '1px solid #d1d5db', borderRadius: '6px',
                  fontSize: '0.875rem', boxSizing: 'border-box', fontFamily: 'monospace',
                }}
              />
              <button
                onClick={() => setShowKey(v => !v)}
                style={{
                  position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0,
                }}
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              onClick={save}
              disabled={saving || !key.trim()}
              style={{
                padding: '0.5rem 1.25rem',
                backgroundColor: !key.trim() || saving ? '#9ca3af' : '#6366f1',
                color: 'white', border: 'none', borderRadius: '6px',
                cursor: !key.trim() || saving ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem', fontWeight: '500', whiteSpace: 'nowrap',
              }}
            >
              {saving ? 'Saving…' : 'Save Key'}
            </button>
          </div>

          {message && (
            <div style={{
              marginTop: '0.75rem', padding: '0.6rem 0.875rem',
              backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: message.type === 'success' ? '#15803d' : '#991b1b',
              borderRadius: '6px', fontSize: '0.8rem',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              {message.type === 'success' ? <Check size={14} /> : <X size={14} />}
              {message.text}
            </div>
          )}
        </>
      )}
    </div>
  )
}
