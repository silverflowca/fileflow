import { useState, useEffect } from 'react'
import { Sparkles, Check, X } from 'lucide-react'

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

export default function AiPromptSettings() {
  const [prompt, setPrompt] = useState('')
  const [original, setOriginal] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    request<{ prompt: string }>('/api/settings/ai-prompt')
      .then(data => { setPrompt(data.prompt); setOriginal(data.prompt) })
      .catch(err => setMessage({ type: 'error', text: err.message }))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await request('/api/settings/ai-prompt', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      })
      setOriginal(prompt)
      setMessage({ type: 'success', text: 'AI prompt saved.' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  const isDirty = prompt !== original

  return (
    <div style={{ padding: '1.5rem', maxWidth: '640px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Sparkles size={18} color="#6366f1" />
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>AI Summary Prompt</h3>
      </div>
      <p style={{ margin: '0 0 1rem', fontSize: '0.825rem', color: '#6b7280' }}>
        This prompt is sent to Claude when summarizing an audio transcript. Customize it to match your workflow.
      </p>

      {loading ? (
        <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading…</div>
      ) : (
        <>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={6}
            style={{
              width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px',
              fontSize: '0.875rem', lineHeight: '1.6', resize: 'vertical', boxSizing: 'border-box',
              fontFamily: 'inherit', color: '#111827',
            }}
          />

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

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={save}
              disabled={saving || !isDirty}
              style={{
                padding: '0.5rem 1.25rem',
                backgroundColor: !isDirty || saving ? '#9ca3af' : '#6366f1',
                color: 'white', border: 'none', borderRadius: '6px',
                cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem', fontWeight: '500',
              }}
            >
              {saving ? 'Saving…' : 'Save Prompt'}
            </button>
            {isDirty && (
              <button
                onClick={() => setPrompt(original)}
                style={{
                  padding: '0.5rem 1rem', backgroundColor: 'white', color: '#374151',
                  border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem',
                }}
              >
                Reset
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
