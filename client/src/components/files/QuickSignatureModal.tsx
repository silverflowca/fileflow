import { useState } from 'react'
import { X, PenTool, Plus, Trash2, Send, UserPlus } from 'lucide-react'
import { File as FileType } from '../../types/files'
import api from '../../lib/api'

interface QuickSignatureModalProps {
  file: FileType
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface Signatory {
  name: string
  email: string
  title: string
}

export default function QuickSignatureModal({
  file,
  isOpen,
  onClose,
  onSuccess
}: QuickSignatureModalProps) {
  const [title, setTitle] = useState(file?.name?.replace(/\.[^/.]+$/, '') || 'Signature Request')
  const [description, setDescription] = useState('')
  const [signatories, setSignatories] = useState<Signatory[]>([
    { name: '', email: '', title: '' }
  ])
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [sendImmediately, setSendImmediately] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addSignatory = () => {
    setSignatories([...signatories, { name: '', email: '', title: '' }])
  }

  const removeSignatory = (index: number) => {
    if (signatories.length > 1) {
      setSignatories(signatories.filter((_, i) => i !== index))
    }
  }

  const updateSignatory = (index: number, field: keyof Signatory, value: string) => {
    const updated = [...signatories]
    updated[index] = { ...updated[index], [field]: value }
    setSignatories(updated)
  }

  const validateForm = () => {
    if (!title.trim()) {
      setError('Please enter a title')
      return false
    }

    const validSignatories = signatories.filter(s => s.name.trim() && s.email.trim())
    if (validSignatories.length === 0) {
      setError('Please add at least one signatory with name and email')
      return false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const sig of validSignatories) {
      if (!emailRegex.test(sig.email)) {
        setError(`Invalid email: ${sig.email}`)
        return false
      }
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    setError(null)

    try {
      const validSignatories = signatories.filter(s => s.name.trim() && s.email.trim())

      const expiresAt = expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined

      // Create signature request
      const request = await api.createSignatureRequest({
        title: title.trim(),
        description: description.trim() || undefined,
        file_id: file.id,
        signatories: validSignatories.map(s => ({
          name: s.name.trim(),
          email: s.email.trim(),
          title: s.title.trim() || undefined
        })),
        expires_at: expiresAt
      })

      // Send immediately if requested
      if (sendImmediately && request.id) {
        await api.sendSignatureRequest(request.id)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create signature request')
    } finally {
      setLoading(false)
    }
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
        maxWidth: '550px',
        maxHeight: '90vh',
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
              Request Signatures
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
              For: {file.name}
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
        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem 1.5rem' }}>
          {/* Title */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.375rem' }}>
              Request Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Contract Agreement"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem'
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.375rem' }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any notes for signatories..."
              rows={2}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Signatories */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                Signatories *
              </label>
              <button
                onClick={addSignatory}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <UserPlus size={14} />
                Add
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {signatories.map((sig, index) => (
                <div
                  key={index}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>
                      Signatory {index + 1}
                    </span>
                    {signatories.length > 1 && (
                      <button
                        onClick={() => removeSignatory(index)}
                        style={{
                          padding: '0.25rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#ef4444',
                          borderRadius: '4px'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Full name *"
                      value={sig.name}
                      onChange={(e) => updateSignatory(index, 'name', e.target.value)}
                      style={{
                        padding: '0.375rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        fontSize: '0.8rem'
                      }}
                    />
                    <input
                      type="email"
                      placeholder="Email address *"
                      value={sig.email}
                      onChange={(e) => updateSignatory(index, 'email', e.target.value)}
                      style={{
                        padding: '0.375rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        fontSize: '0.8rem'
                      }}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Title/Role (optional)"
                    value={sig.title}
                    onChange={(e) => updateSignatory(index, 'title', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.375rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.8rem'
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Options */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.375rem' }}>
                Expires in
              </label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.875rem',
                  backgroundColor: 'white'
                }}
              >
                <option value={0}>No expiration</option>
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
              </select>
            </div>
          </div>

          {/* Send immediately checkbox */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}>
            <input
              type="checkbox"
              checked={sendImmediately}
              onChange={(e) => setSendImmediately(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Send signing invitations immediately
          </label>

          {error && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              borderRadius: '6px',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
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
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1.25rem',
              backgroundColor: loading ? '#9ca3af' : '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? (
              'Creating...'
            ) : (
              <>
                <Send size={16} />
                {sendImmediately ? 'Create & Send' : 'Create Draft'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
