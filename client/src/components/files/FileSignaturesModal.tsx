import { useState, useEffect } from 'react'
import { X, PenTool, Clock, CheckCircle, XCircle, AlertCircle, Send, Eye, Plus, Users } from 'lucide-react'
import { File as FileType } from '../../types/files'
import api from '../../lib/api'

interface FileSignaturesModalProps {
  file: FileType
  isOpen: boolean
  onClose: () => void
  onCreateNew: () => void
}

interface SignatureRequest {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'pending' | 'completed' | 'cancelled' | 'expired'
  created_at: string
  expires_at: string | null
  completed_at: string | null
  signatories: {
    id: string
    name: string
    email: string
    status: 'pending' | 'signed' | 'declined'
    signed_at: string | null
  }[]
}

export default function FileSignaturesModal({
  file,
  isOpen,
  onClose,
  onCreateNew
}: FileSignaturesModalProps) {
  const [signatures, setSignatures] = useState<SignatureRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && file) {
      loadSignatures()
    }
  }, [isOpen, file?.id])

  const loadSignatures = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getFileSignatures(file.id)
      setSignatures(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load signatures')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} style={{ color: '#10b981' }} />
      case 'pending':
        return <Clock size={16} style={{ color: '#f59e0b' }} />
      case 'cancelled':
      case 'expired':
        return <XCircle size={16} style={{ color: '#ef4444' }} />
      case 'draft':
        return <AlertCircle size={16} style={{ color: '#6b7280' }} />
      default:
        return <Clock size={16} style={{ color: '#6b7280' }} />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: '#dcfce7', text: '#166534' }
      case 'pending':
        return { bg: '#fef3c7', text: '#92400e' }
      case 'cancelled':
      case 'expired':
        return { bg: '#fee2e2', text: '#dc2626' }
      case 'draft':
        return { bg: '#f3f4f6', text: '#374151' }
      default:
        return { bg: '#f3f4f6', text: '#374151' }
    }
  }

  const handleSendRequest = async (requestId: string) => {
    try {
      await api.sendSignatureRequest(requestId)
      loadSignatures()
    } catch (err: any) {
      alert(err.message || 'Failed to send request')
    }
  }

  const handleViewStatus = (requestId: string) => {
    window.open(`/esignature/status/${requestId}`, '_blank')
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PenTool size={20} style={{ color: '#8b5cf6' }} />
              E-Signatures
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
              {file.name}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              Loading signatures...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
              {error}
            </div>
          ) : signatures.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <PenTool size={48} style={{ color: '#d1d5db', marginBottom: '1rem' }} />
              <p style={{ color: '#6b7280', margin: '0 0 1rem' }}>
                No signature requests for this file yet
              </p>
              <button
                onClick={onCreateNew}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} />
                Create Signature Request
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {signatures.map((sig) => {
                const statusColors = getStatusColor(sig.status)
                const signedCount = sig.signatories.filter(s => s.status === 'signed').length
                const totalSignatories = sig.signatories.length

                return (
                  <div
                    key={sig.id}
                    style={{
                      padding: '1rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
                          {sig.title}
                        </h4>
                        {sig.description && (
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                            {sig.description}
                          </p>
                        )}
                      </div>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: statusColors.bg,
                        color: statusColors.text,
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        textTransform: 'capitalize'
                      }}>
                        {getStatusIcon(sig.status)}
                        {sig.status}
                      </span>
                    </div>

                    {/* Signatories */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <Users size={14} style={{ color: '#6b7280' }} />
                      <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        {signedCount} of {totalSignatories} signed
                      </span>
                      <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                        {sig.signatories.map((s, i) => (
                          <div
                            key={s.id}
                            title={`${s.name} (${s.email}) - ${s.status}`}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: s.status === 'signed' ? '#10b981' : s.status === 'declined' ? '#ef4444' : '#d1d5db',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.625rem',
                              fontWeight: '600'
                            }}
                          >
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Date info */}
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
                      Created {new Date(sig.created_at).toLocaleDateString()}
                      {sig.expires_at && (
                        <> · Expires {new Date(sig.expires_at).toLocaleDateString()}</>
                      )}
                      {sig.completed_at && (
                        <> · Completed {new Date(sig.completed_at).toLocaleDateString()}</>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleViewStatus(sig.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          padding: '0.375rem 0.75rem',
                          backgroundColor: 'white',
                          color: '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        <Eye size={14} />
                        View Details
                      </button>
                      {sig.status === 'draft' && (
                        <button
                          onClick={() => handleSendRequest(sig.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.375rem 0.75rem',
                            backgroundColor: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          <Send size={14} />
                          Send for Signing
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
          {signatures.length > 0 && (
            <button
              onClick={onCreateNew}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} />
              New Request
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
