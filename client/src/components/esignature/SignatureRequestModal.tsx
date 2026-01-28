import { useState, useEffect } from 'react';
import { X, Plus, Trash2, FileText, Users, Send, GripVertical } from 'lucide-react';
import { SignatoryInput, CreateSignatureRequestInput } from '../../types/esignature';
import { FileRecord } from '../../contexts/FileContext';

interface SignatureRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateSignatureRequestInput) => Promise<void>;
  selectedFile?: FileRecord | null;
}

export default function SignatureRequestModal({
  isOpen,
  onClose,
  onSubmit,
  selectedFile
}: SignatureRequestModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [signatories, setSignatories] = useState<SignatoryInput[]>([
    { name: '', email: '', title: '' }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(selectedFile ? `Sign: ${selectedFile.name}` : '');
      setDescription('');
      setSignatories([{ name: '', email: '', title: '' }]);
      setError(null);
    }
  }, [isOpen, selectedFile]);

  const addSignatory = () => {
    setSignatories([...signatories, { name: '', email: '', title: '' }]);
  };

  const removeSignatory = (index: number) => {
    if (signatories.length > 1) {
      setSignatories(signatories.filter((_, i) => i !== index));
    }
  };

  const updateSignatory = (index: number, field: keyof SignatoryInput, value: string) => {
    const updated = [...signatories];
    updated[index] = { ...updated[index], [field]: value };
    setSignatories(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (!title.trim()) {
      setError('Please enter a title for the signature request');
      return;
    }

    const validSignatories = signatories.filter(s => s.name.trim() && s.email.trim());
    if (validSignatories.length === 0) {
      setError('Please add at least one signatory with name and email');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const s of validSignatories) {
      if (!emailRegex.test(s.email)) {
        setError(`Invalid email address: ${s.email}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        file_id: selectedFile?.id,
        signatories: validSignatories
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create signature request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={20} style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                Request E-Signatures
              </h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                Add signatories to sign this document
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              background: 'none',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{
          flex: 1,
          overflow: 'auto',
          padding: '1.5rem'
        }}>
          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '0.875rem',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          {/* Document info */}
          {selectedFile && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <FileText size={24} style={{ color: '#6b7280' }} />
              <div>
                <p style={{ margin: 0, fontWeight: '500', fontSize: '0.875rem' }}>
                  {selectedFile.name}
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                  Selected document for signing
                </p>
              </div>
            </div>
          )}

          {/* Title */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              marginBottom: '0.5rem',
              color: '#374151'
            }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Service Agreement - Q1 2024"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.875rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              marginBottom: '0.5rem',
              color: '#374151'
            }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any instructions or notes for signatories..."
              rows={2}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.875rem',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Signatories */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} style={{ color: '#6b7280' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Signatories
                </span>
              </div>
              <button
                type="button"
                onClick={addSignatory}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  color: '#3b82f6',
                  backgroundColor: '#eff6ff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                <Plus size={14} />
                Add Signatory
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {signatories.map((signatory, index) => (
                <div key={index} style={{
                  padding: '1rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem'
                  }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Signatory {index + 1}
                    </span>
                    {signatories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSignatory(index)}
                        style={{
                          padding: '0.25rem',
                          background: 'none',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: '#ef4444'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem'
                  }}>
                    <div>
                      <input
                        type="text"
                        value={signatory.name}
                        onChange={(e) => updateSignatory(index, 'name', e.target.value)}
                        placeholder="Full Name *"
                        style={{
                          width: '100%',
                          padding: '0.625rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          boxSizing: 'border-box',
                          backgroundColor: 'white'
                        }}
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        value={signatory.email}
                        onChange={(e) => updateSignatory(index, 'email', e.target.value)}
                        placeholder="Email Address *"
                        style={{
                          width: '100%',
                          padding: '0.625rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          boxSizing: 'border-box',
                          backgroundColor: 'white'
                        }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <input
                        type="text"
                        value={signatory.title || ''}
                        onChange={(e) => updateSignatory(index, 'title', e.target.value)}
                        placeholder="Title/Role (e.g., CEO, Witness)"
                        style={{
                          width: '100%',
                          padding: '0.625rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          boxSizing: 'border-box',
                          backgroundColor: 'white'
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'white',
              backgroundColor: submitting ? '#93c5fd' : '#3b82f6',
              border: 'none',
              borderRadius: '8px',
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            <Send size={16} />
            {submitting ? 'Creating...' : 'Create & Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
