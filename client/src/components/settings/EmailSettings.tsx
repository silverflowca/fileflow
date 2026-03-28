import { useState, useEffect } from 'react'
import { Mail, Check, X, Send } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8680'

function getToken(): string | null {
  return localStorage.getItem('fileflow_token')
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

export default function EmailSettings() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const data = await request<any>('/api/email/config')
      setConfig(data)
    } catch (error) {
      console.error('Failed to load email config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setMessage(null)
    try {
      const result = await request<any>('/api/email/verify', { method: 'POST' })
      if (result.success) {
        setMessage({ type: 'success', text: 'SMTP configuration is valid!' })
      } else {
        setMessage({ type: 'error', text: result.message })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setVerifying(false)
    }
  }

  const handleSendTest = async () => {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Please enter an email address' })
      return
    }

    setSendingTest(true)
    setMessage(null)
    try {
      const result = await request<any>('/api/email/test', {
        method: 'POST',
        body: JSON.stringify({ to: testEmail })
      })
      if (result.success) {
        setMessage({ type: 'success', text: `Test email sent to ${testEmail}!` })
        setTestEmail('')
      } else {
        setMessage({ type: 'error', text: result.message })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSendingTest(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#6b7280' }}>Loading email settings...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '2rem'
      }}>
        <Mail size={24} style={{ color: '#3b82f6' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>Email Configuration</h2>
      </div>

      {/* Configuration Status */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        border: '1px solid #e5e7eb'
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Status</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          {config?.configured ? (
            <>
              <Check size={20} style={{ color: '#10b981' }} />
              <span style={{ color: '#10b981', fontWeight: '500' }}>SMTP Configured</span>
            </>
          ) : (
            <>
              <X size={20} style={{ color: '#ef4444' }} />
              <span style={{ color: '#ef4444', fontWeight: '500' }}>SMTP Not Configured</span>
            </>
          )}
        </div>

        {config?.configured && (
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '1.75rem' }}>
            <p style={{ margin: '0.25rem 0' }}><strong>Host:</strong> {config.host}</p>
            <p style={{ margin: '0.25rem 0' }}><strong>Port:</strong> {config.port}</p>
            <p style={{ margin: '0.25rem 0' }}><strong>User:</strong> {config.user}</p>
            <p style={{ margin: '0.25rem 0' }}><strong>From:</strong> {config.from}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {config?.configured && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Test Email</h3>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Enter email address"
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
            />
            <button
              onClick={handleSendTest}
              disabled={sendingTest}
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
                cursor: sendingTest ? 'not-allowed' : 'pointer',
                opacity: sendingTest ? 0.6 : 1
              }}
            >
              <Send size={16} />
              {sendingTest ? 'Sending...' : 'Send Test'}
            </button>
          </div>

          <button
            onClick={handleVerify}
            disabled={verifying}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: verifying ? 'not-allowed' : 'pointer',
              opacity: verifying ? 0.6 : 1
            }}
          >
            {verifying ? 'Verifying...' : 'Verify SMTP Connection'}
          </button>
        </div>
      )}

      {/* Configuration Instructions */}
      {!config?.configured && (
        <div style={{
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          padding: '1.5rem',
          border: '1px solid #fbbf24'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#92400e' }}>
            How to Configure Email
          </h3>
          <ol style={{ marginLeft: '1.5rem', color: '#78350f', fontSize: '0.875rem', lineHeight: '1.6' }}>
            <li>Open the server's <code>.env</code> file</li>
            <li>Add your SMTP credentials:
              <pre style={{
                backgroundColor: '#fffbeb',
                padding: '0.75rem',
                borderRadius: '4px',
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                overflowX: 'auto'
              }}>
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=FileFlow <noreply@fileflow.local>`}
              </pre>
            </li>
            <li>For Gmail, create an App Password at: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>myaccount.google.com/apppasswords</a></li>
            <li>Restart the FileFlow server</li>
          </ol>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          borderRadius: '6px',
          backgroundColor: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          fontSize: '0.875rem'
        }}>
          {message.text}
        </div>
      )}
    </div>
  )
}
