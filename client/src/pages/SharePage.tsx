import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface ShareFile {
  id: string
  name: string
  file_type: string
  file_extension: string
  size_bytes: number
}

interface ShareData {
  file: ShareFile
  permissions: {
    canView: boolean
    canDownload: boolean
    canEdit: boolean
    canComment: boolean
  }
  downloadUrl: string | null
}

type State =
  | { status: 'loading' }
  | { status: 'password'; fileName?: string }
  | { status: 'ready'; data: ShareData }
  | { status: 'error'; message: string }

async function fetchShare(token: string, password?: string): Promise<ShareData & { requiresPassword?: boolean; fileName?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (password) headers['x-link-password'] = password
  const res = await fetch(`${API_URL}/api/share/${token}`, { headers })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to load share link')
  return json
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    if (!token) { setState({ status: 'error', message: 'Invalid share link.' }); return }
    fetchShare(token)
      .then(data => {
        if (data.requiresPassword) {
          setState({ status: 'password', fileName: data.fileName })
        } else {
          setState({ status: 'ready', data: data as ShareData })
        }
      })
      .catch(err => setState({ status: 'error', message: err.message }))
  }, [token])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !password.trim()) return
    setPwLoading(true)
    setPwError('')
    try {
      const data = await fetchShare(token, password)
      setState({ status: 'ready', data: data as ShareData })
    } catch (err: any) {
      setPwError(err.message === 'Invalid password' ? 'Incorrect password.' : err.message)
    } finally {
      setPwLoading(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#f5f5f7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '24px',
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    padding: '40px 36px',
    maxWidth: 440,
    width: '100%',
    textAlign: 'center',
  }

  if (state.status === 'loading') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={{ color: '#666', margin: 0 }}>Loading…</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#1c1c1e' }}>Link unavailable</h2>
          <p style={{ color: '#666', margin: 0, fontSize: 14 }}>{state.message}</p>
        </div>
      </div>
    )
  }

  if (state.status === 'password') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#1c1c1e' }}>Password required</h2>
          {state.fileName && (
            <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px' }}>{state.fileName}</p>
          )}
          <form onSubmit={handlePasswordSubmit} style={{ textAlign: 'left' }}>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 14px', borderRadius: 8,
                border: pwError ? '1.5px solid #ff3b30' : '1.5px solid #d1d1d6',
                fontSize: 15, outline: 'none', marginBottom: 8,
              }}
            />
            {pwError && <p style={{ color: '#ff3b30', fontSize: 13, margin: '0 0 10px' }}>{pwError}</p>}
            <button
              type="submit"
              disabled={pwLoading || !password.trim()}
              style={{
                width: '100%', padding: '11px', borderRadius: 8,
                background: '#007aff', color: '#fff', border: 'none',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                opacity: pwLoading || !password.trim() ? 0.5 : 1,
              }}
            >
              {pwLoading ? 'Checking…' : 'Access file'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const { file, permissions, downloadUrl } = state.data

  const iconForType = (type: string) => {
    if (type?.startsWith('image/')) return '🖼️'
    if (type?.startsWith('video/')) return '🎬'
    if (type?.startsWith('audio/')) return '🎵'
    if (type === 'application/pdf') return '📄'
    if (type?.includes('word') || type?.includes('document')) return '📝'
    if (type?.includes('sheet') || type?.includes('excel')) return '📊'
    return '📁'
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>{iconForType(file.file_type)}</div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, color: '#1c1c1e', wordBreak: 'break-word' }}>
          {file.name}
        </h2>
        <p style={{ color: '#8e8e93', fontSize: 13, margin: '0 0 28px' }}>
          {file.file_extension?.toUpperCase()} · {formatBytes(file.size_bytes)}
        </p>

        {permissions.canDownload && downloadUrl ? (
          <a
            href={downloadUrl}
            download={file.name}
            style={{
              display: 'inline-block', padding: '12px 28px',
              background: '#007aff', color: '#fff', borderRadius: 10,
              textDecoration: 'none', fontWeight: 600, fontSize: 15,
            }}
          >
            Download
          </a>
        ) : (
          <p style={{ color: '#8e8e93', fontSize: 14 }}>
            {permissions.canView ? 'This file is view-only.' : 'You do not have permission to access this file.'}
          </p>
        )}

        <p style={{ marginTop: 28, fontSize: 12, color: '#c7c7cc' }}>
          Shared via FileFlow
        </p>
      </div>
    </div>
  )
}
