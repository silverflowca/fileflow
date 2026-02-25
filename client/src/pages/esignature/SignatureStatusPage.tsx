import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  FileText, Check, Clock, AlertCircle, User, Calendar,
  CheckCircle2, XCircle, Mail, Loader2
} from 'lucide-react'

interface SignatureStatus {
  id: string
  title: string
  description: string | null
  status: string
  created_at: string
  expires_at: string | null
  completed_at: string | null
  original_file_name: string | null
  signatories: {
    name: string
    title: string | null
    status: string
    order_index: number
    signed_at: string | null
    email_masked: string | null
  }[]
  progress: {
    total: number
    signed: number
    pending: number
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8680'

export default function SignatureStatusPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const [searchParams] = useSearchParams()
  const isEmbed = searchParams.get('embed') === 'true'

  const [status, setStatus] = useState<SignatureStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStatus()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStatus, 30000)
    return () => clearInterval(interval)
  }, [requestId])

  const loadStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/esignature/status/${requestId}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load status')
      }
      const data = await response.json()
      setStatus(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (statusValue: string) => {
    switch (statusValue) {
      case 'completed': return '#16a34a'
      case 'in_progress': return '#f59e0b'
      case 'pending': return '#3b82f6'
      case 'cancelled': return '#ef4444'
      case 'signed': return '#16a34a'
      case 'sent': return '#3b82f6'
      case 'viewed': return '#8b5cf6'
      default: return '#6b7280'
    }
  }

  const getStatusIcon = (statusValue: string) => {
    switch (statusValue) {
      case 'completed':
      case 'signed':
        return <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
      case 'in_progress':
      case 'viewed':
        return <Clock size={20} style={{ color: '#f59e0b' }} />
      case 'pending':
      case 'sent':
        return <Mail size={20} style={{ color: '#3b82f6' }} />
      case 'cancelled':
        return <XCircle size={20} style={{ color: '#ef4444' }} />
      default:
        return <AlertCircle size={20} style={{ color: '#6b7280' }} />
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div style={{
        minHeight: isEmbed ? '300px' : '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isEmbed ? 'transparent' : '#f9fafb',
      }}>
        <Loader2 size={32} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (error || !status) {
    return (
      <div style={{
        minHeight: isEmbed ? '200px' : '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isEmbed ? 'transparent' : '#f9fafb',
      }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            {error || 'Request Not Found'}
          </h2>
          <p style={{ color: '#6b7280' }}>
            This signature request may have been deleted or the link is invalid.
          </p>
        </div>
      </div>
    )
  }

  const progressPercent = status.progress.total > 0
    ? Math.round((status.progress.signed / status.progress.total) * 100)
    : 0

  return (
    <div style={{
      minHeight: isEmbed ? 'auto' : '100vh',
      backgroundColor: isEmbed ? 'transparent' : '#f9fafb',
      padding: isEmbed ? '0' : '2rem',
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: isEmbed ? '0' : '12px',
        boxShadow: isEmbed ? 'none' : '0 4px 20px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: getStatusColor(status.status),
          padding: '1.5rem',
          color: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <FileText size={24} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
              {status.title}
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>
            E-Signature Request Status
          </p>
        </div>

        {/* Status Badge */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {getStatusIcon(status.status)}
            <span style={{
              fontWeight: '600',
              textTransform: 'uppercase',
              fontSize: '0.875rem',
              color: getStatusColor(status.status),
            }}>
              {status.status.replace('_', ' ')}
            </span>
          </div>
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {progressPercent}% complete
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ padding: '0 1.5rem', paddingTop: '1rem' }}>
          <div style={{
            height: '8px',
            backgroundColor: '#e5e7eb',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: status.status === 'completed' ? '#16a34a' : '#3b82f6',
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
            {status.progress.signed} of {status.progress.total} signatures collected
          </p>
        </div>

        {/* Details */}
        <div style={{ padding: '1.5rem' }}>
          {status.description && (
            <p style={{ color: '#4b5563', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {status.description}
            </p>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            fontSize: '0.875rem',
          }}>
            <div>
              <span style={{ color: '#6b7280' }}>Created</span>
              <p style={{ fontWeight: '500', margin: '0.25rem 0 0 0' }}>
                {formatDate(status.created_at)}
              </p>
            </div>
            {status.completed_at && (
              <div>
                <span style={{ color: '#6b7280' }}>Completed</span>
                <p style={{ fontWeight: '500', margin: '0.25rem 0 0 0', color: '#16a34a' }}>
                  {formatDate(status.completed_at)}
                </p>
              </div>
            )}
            {status.expires_at && !status.completed_at && (
              <div>
                <span style={{ color: '#6b7280' }}>Expires</span>
                <p style={{ fontWeight: '500', margin: '0.25rem 0 0 0' }}>
                  {formatDate(status.expires_at)}
                </p>
              </div>
            )}
            {status.original_file_name && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: '#6b7280' }}>Document</span>
                <p style={{ fontWeight: '500', margin: '0.25rem 0 0 0' }}>
                  {status.original_file_name}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Signatories */}
        <div style={{ borderTop: '1px solid #e5e7eb' }}>
          <h3 style={{
            padding: '1rem 1.5rem',
            margin: 0,
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151',
            backgroundColor: '#f9fafb',
          }}>
            Signatories
          </h3>
          <div>
            {status.signatories.map((signatory, index) => (
              <div
                key={index}
                style={{
                  padding: '1rem 1.5rem',
                  borderBottom: index < status.signatories.length - 1 ? '1px solid #f3f4f6' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: signatory.status === 'signed' ? '#dcfce7' : '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {signatory.status === 'signed' ? (
                    <Check size={20} style={{ color: '#16a34a' }} />
                  ) : (
                    <User size={20} style={{ color: '#6b7280' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: '500', margin: 0, fontSize: '0.875rem' }}>
                    {signatory.name}
                    {signatory.title && (
                      <span style={{ color: '#6b7280', fontWeight: '400' }}> - {signatory.title}</span>
                    )}
                  </p>
                  {signatory.email_masked && (
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.125rem 0 0 0' }}>
                      {signatory.email_masked}
                    </p>
                  )}
                  {signatory.signed_at && (
                    <p style={{ fontSize: '0.75rem', color: '#16a34a', margin: '0.25rem 0 0 0' }}>
                      Signed {formatDate(signatory.signed_at)}
                    </p>
                  )}
                </div>
                <div style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  backgroundColor: signatory.status === 'signed' ? '#dcfce7' : '#f3f4f6',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: signatory.status === 'signed' ? '#16a34a' : '#6b7280',
                  textTransform: 'capitalize',
                }}>
                  {signatory.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        {!isEmbed && (
          <div style={{
            padding: '1rem 1.5rem',
            backgroundColor: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
              Powered by FileFlow E-Signature
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
