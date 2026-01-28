import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Trash2,
  Eye,
  Users,
  ArrowLeft,
  MoreVertical,
  RefreshCw,
  Mail,
  Copy,
  ExternalLink,
  Download
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useFiles } from '../../contexts/FileContext';
import { useESignature } from '../../contexts/ESignatureContext';
import { formatFileSize } from '../../lib/supabase';
import { SignatureRequest, Signatory } from '../../types/esignature';
import SignatureRequestModal from '../../components/esignature/SignatureRequestModal';
import { FileRecord } from '../../contexts/FileContext';

export default function ESignaturePage() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { files } = useFiles();
  const { requests, loading, error, fetchRequests, createRequest, sendRequest, cancelRequest, deleteRequest } = useESignature();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

  // Fetch requests on mount
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Get PDF files for selection
  const pdfFiles = files.filter(f => f.file_type.includes('pdf'));

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
      draft: { bg: '#f3f4f6', color: '#4b5563', icon: <FileText size={14} /> },
      pending: { bg: '#fef3c7', color: '#92400e', icon: <Clock size={14} /> },
      in_progress: { bg: '#dbeafe', color: '#1e40af', icon: <RefreshCw size={14} /> },
      completed: { bg: '#dcfce7', color: '#166534', icon: <CheckCircle size={14} /> },
      cancelled: { bg: '#fee2e2', color: '#991b1b', icon: <XCircle size={14} /> }
    };

    const style = styles[status] || styles.draft;

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.25rem 0.75rem',
        fontSize: '0.75rem',
        fontWeight: '500',
        borderRadius: '9999px',
        backgroundColor: style.bg,
        color: style.color,
        textTransform: 'capitalize'
      }}>
        {style.icon}
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getSignatoryStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return <CheckCircle size={14} style={{ color: '#16a34a' }} />;
      case 'viewed':
        return <Eye size={14} style={{ color: '#2563eb' }} />;
      case 'sent':
        return <Mail size={14} style={{ color: '#9333ea' }} />;
      case 'declined':
        return <XCircle size={14} style={{ color: '#dc2626' }} />;
      default:
        return <Clock size={14} style={{ color: '#6b7280' }} />;
    }
  };

  const handleCreateRequest = async (input: any) => {
    await createRequest(input);
    setShowCreateModal(false);
    setSelectedFile(null);
  };

  const handleCopyLink = (signatory: Signatory) => {
    const link = `${window.location.origin}/sign/${signatory.access_token}`;
    navigator.clipboard.writeText(link);
    alert('Signing link copied to clipboard!');
  };

  const handleOpenLink = (signatory: Signatory) => {
    const link = `${window.location.origin}/sign/${signatory.access_token}`;
    window.open(link, '_blank');
  };

  const handleDownloadPdf = async (requestId: string) => {
    try {
      await api.downloadSignedPdf(requestId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download PDF');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 2rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate('/')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                background: 'none',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#6b7280'
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>E-Signatures</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {profile && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: '500', margin: 0 }}>{profile.display_name}</p>
                <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>
                  {formatFileSize(profile.storage_used_bytes)} / {formatFileSize(profile.storage_quota_bytes)}
                </p>
              </div>
            )}
            <button
              onClick={signOut}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '2rem'
      }}>
        {/* Actions Bar */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: '600' }}>
              Signature Requests
            </h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
              Create and manage document signing requests
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <Plus size={18} />
            New Signature Request
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            marginBottom: '1.5rem'
          }}>
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '3rem',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <RefreshCw size={32} style={{ color: '#6b7280', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#6b7280', marginTop: '1rem' }}>Loading signature requests...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Empty State */}
        {!loading && requests.length === 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '3rem',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem'
            }}>
              <FileText size={32} style={{ color: '#3b82f6' }} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: '600' }}>
              No Signature Requests Yet
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: '#6b7280', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
              Create your first signature request to get documents signed electronically by multiple parties.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <Plus size={18} />
              Create Request
            </button>
          </div>
        )}

        {/* Requests List */}
        {!loading && requests.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            {requests.map((request, index) => (
              <div key={request.id}>
                {index > 0 && <div style={{ borderTop: '1px solid #e5e7eb' }} />}

                <div style={{
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <h3 style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: '600',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {request.title}
                      </h3>
                      {getStatusBadge(request.status)}
                    </div>

                    {request.description && (
                      <p style={{
                        margin: '0 0 0.5rem',
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {request.description}
                      </p>
                    )}

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      fontSize: '0.75rem',
                      color: '#9ca3af'
                    }}>
                      <span>Created {new Date(request.created_at).toLocaleDateString()}</span>
                      {request.signatories && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Users size={12} />
                          {request.signatories.filter(s => s.status === 'signed').length}/{request.signatories.length} signed
                        </span>
                      )}
                    </div>

                    {/* Signatories Preview */}
                    {request.signatories && request.signatories.length > 0 && (
                      <button
                        onClick={() => setExpandedRequest(expandedRequest === request.id ? null : request.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginTop: '0.75rem',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.75rem',
                          color: '#3b82f6',
                          backgroundColor: '#eff6ff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        <Users size={14} />
                        {expandedRequest === request.id ? 'Hide' : 'View'} Signatories ({request.signatories.length})
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === request.id ? null : request.id)}
                      style={{
                        padding: '0.5rem',
                        background: 'none',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#6b7280'
                      }}
                    >
                      <MoreVertical size={18} />
                    </button>

                    {activeDropdown === request.id && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '0.25rem',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        border: '1px solid #e5e7eb',
                        minWidth: '160px',
                        zIndex: 10
                      }}>
                        {request.status === 'draft' && (
                          <button
                            onClick={() => {
                              sendRequest(request.id);
                              setActiveDropdown(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              width: '100%',
                              padding: '0.625rem 1rem',
                              fontSize: '0.875rem',
                              color: '#374151',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <Send size={16} />
                            Send Request
                          </button>
                        )}
                        <button
                          onClick={() => {
                            handleDownloadPdf(request.id);
                            setActiveDropdown(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            width: '100%',
                            padding: '0.625rem 1rem',
                            fontSize: '0.875rem',
                            color: '#374151',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          <Download size={16} />
                          Download PDF
                        </button>
                        {request.status !== 'completed' && request.status !== 'cancelled' && (
                          <button
                            onClick={() => {
                              cancelRequest(request.id);
                              setActiveDropdown(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              width: '100%',
                              padding: '0.625rem 1rem',
                              fontSize: '0.875rem',
                              color: '#dc2626',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <XCircle size={16} />
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this request?')) {
                              deleteRequest(request.id);
                            }
                            setActiveDropdown(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            width: '100%',
                            padding: '0.625rem 1rem',
                            fontSize: '0.875rem',
                            color: '#dc2626',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Signatories */}
                {expandedRequest === request.id && request.signatories && (
                  <div style={{
                    borderTop: '1px solid #e5e7eb',
                    padding: '1rem 1.5rem',
                    backgroundColor: '#f9fafb'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {request.signatories.map((signatory, idx) => (
                        <div key={signatory.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: '#e5e7eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: '#6b7280'
                            }}>
                              {idx + 1}
                            </span>
                            <div>
                              <p style={{ margin: 0, fontWeight: '500', fontSize: '0.875rem' }}>
                                {signatory.name}
                                {signatory.title && (
                                  <span style={{ color: '#6b7280', fontWeight: '400' }}> - {signatory.title}</span>
                                )}
                              </p>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                                {signatory.email}
                              </p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.75rem',
                              color: '#6b7280',
                              textTransform: 'capitalize'
                            }}>
                              {getSignatoryStatusIcon(signatory.status)}
                              {signatory.status}
                            </span>
                            {signatory.status !== 'signed' && (
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                  onClick={() => handleCopyLink(signatory)}
                                  title="Copy signing link"
                                  style={{
                                    padding: '0.375rem',
                                    background: 'none',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    color: '#6b7280'
                                  }}
                                >
                                  <Copy size={14} />
                                </button>
                                <button
                                  onClick={() => handleOpenLink(signatory)}
                                  title="Open signing page"
                                  style={{
                                    padding: '0.375rem',
                                    background: 'none',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    color: '#6b7280'
                                  }}
                                >
                                  <ExternalLink size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      <SignatureRequestModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedFile(null);
        }}
        onSubmit={handleCreateRequest}
        selectedFile={selectedFile}
      />

      {/* Click outside handler for dropdown */}
      {activeDropdown && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 5
          }}
          onClick={() => setActiveDropdown(null)}
        />
      )}
    </div>
  );
}
