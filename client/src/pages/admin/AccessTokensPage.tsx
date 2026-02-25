import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Key, Plus, Search, ArrowLeft, X, Copy, Check, Trash2,
  Eye, Download, Edit2, Shield, Clock, AlertCircle, RefreshCw,
  FileText, FolderOpen, Globe, Lock
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useFiles } from '../../contexts/FileContext'
import api from '../../lib/api'

interface AccessToken {
  id: string
  name: string
  token_prefix: string
  scope_type: string
  file_ids: string[]
  folder_ids: string[]
  can_view: boolean
  can_download: boolean
  can_edit: boolean
  can_delete: boolean
  can_share: boolean
  is_active: boolean
  expires_at: string | null
  last_used_at: string | null
  usage_count: number
  current_downloads: number
  max_downloads: number | null
  created_at: string
}

export default function AccessTokensPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { files, folders } = useFiles()
  const [tokens, setTokens] = useState<AccessToken[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedToken, setSelectedToken] = useState<AccessToken | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)

  // Form state
  const [tokenForm, setTokenForm] = useState({
    name: '',
    scope_type: 'all' as 'all' | 'folder' | 'specific',
    file_ids: [] as string[],
    folder_ids: [] as string[],
    can_view: true,
    can_download: false,
    can_edit: false,
    can_delete: false,
    can_share: false,
    max_downloads: undefined as number | undefined,
    expires_days: undefined as number | undefined
  })

  useEffect(() => {
    loadTokens()
  }, [])

  const loadTokens = async () => {
    setLoading(true)
    try {
      const data = await api.getDocumentTokens()
      setTokens(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tokens')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateToken = async () => {
    if (!tokenForm.name) {
      alert('Token name is required')
      return
    }
    setActionLoading(true)
    try {
      const result = await api.createDocumentToken({
        name: tokenForm.name,
        scope_type: tokenForm.scope_type,
        file_ids: tokenForm.scope_type === 'specific' ? tokenForm.file_ids : [],
        folder_ids: tokenForm.scope_type === 'folder' ? tokenForm.folder_ids : [],
        can_view: tokenForm.can_view,
        can_download: tokenForm.can_download,
        can_edit: tokenForm.can_edit,
        can_delete: tokenForm.can_delete,
        can_share: tokenForm.can_share,
        max_downloads: tokenForm.max_downloads,
        expires_at: tokenForm.expires_days
          ? new Date(Date.now() + tokenForm.expires_days * 24 * 60 * 60 * 1000).toISOString()
          : undefined
      })
      setNewTokenValue(result.token)
      loadTokens()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create token')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateToken = async () => {
    if (!selectedToken) return
    setActionLoading(true)
    try {
      await api.updateDocumentToken(selectedToken.id, {
        name: tokenForm.name,
        is_active: selectedToken.is_active,
        can_view: tokenForm.can_view,
        can_download: tokenForm.can_download,
        can_edit: tokenForm.can_edit,
        can_delete: tokenForm.can_delete,
        can_share: tokenForm.can_share,
        max_downloads: tokenForm.max_downloads || null,
        file_ids: tokenForm.scope_type === 'specific' ? tokenForm.file_ids : [],
        folder_ids: tokenForm.scope_type === 'folder' ? tokenForm.folder_ids : []
      })
      setShowEditModal(false)
      setSelectedToken(null)
      loadTokens()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update token')
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleActive = async (token: AccessToken) => {
    try {
      await api.updateDocumentToken(token.id, { is_active: !token.is_active })
      loadTokens()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update token')
    }
  }

  const handleDeleteToken = async (token: AccessToken) => {
    if (!confirm(`Delete token "${token.name}"? This action cannot be undone.`)) return
    try {
      await api.deleteDocumentToken(token.id)
      loadTokens()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete token')
    }
  }

  const copyTokenToClipboard = async () => {
    if (newTokenValue) {
      await navigator.clipboard.writeText(newTokenValue)
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    }
  }

  const openEditModal = (token: AccessToken) => {
    setSelectedToken(token)
    setTokenForm({
      name: token.name,
      scope_type: token.scope_type as 'all' | 'folder' | 'specific',
      file_ids: token.file_ids || [],
      folder_ids: token.folder_ids || [],
      can_view: token.can_view,
      can_download: token.can_download,
      can_edit: token.can_edit,
      can_delete: token.can_delete,
      can_share: token.can_share,
      max_downloads: token.max_downloads || undefined,
      expires_days: undefined
    })
    setShowEditModal(true)
  }

  const resetForm = () => {
    setTokenForm({
      name: '',
      scope_type: 'all',
      file_ids: [],
      folder_ids: [],
      can_view: true,
      can_download: false,
      can_edit: false,
      can_delete: false,
      can_share: false,
      max_downloads: undefined,
      expires_days: undefined
    })
    setNewTokenValue(null)
  }

  const filteredTokens = tokens.filter(token =>
    token.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getScopeIcon = (scopeType: string) => {
    switch (scopeType) {
      case 'all': return <Globe size={16} style={{ color: '#3b82f6' }} />
      case 'folder': return <FolderOpen size={16} style={{ color: '#f59e0b' }} />
      case 'specific': return <FileText size={16} style={{ color: '#10b981' }} />
      default: return <Lock size={16} style={{ color: '#6b7280' }} />
    }
  }

  if (profile?.role !== 'admin') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Access denied</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#1e293b',
        color: 'white',
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
              onClick={() => navigate('/admin')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>
                Document Access Tokens
              </h1>
              <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: 0 }}>
                Manage API access and permissions
              </p>
            </div>
          </div>
        </div>
      </header>

      <main style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '2rem'
      }}>
        {/* Info Banner */}
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem'
        }}>
          <Key size={20} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ margin: 0, fontWeight: '500', color: '#1e40af' }}>Document Access Tokens</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#3b82f6' }}>
              Create tokens to provide external access to files. Tokens can be restricted to specific files, folders,
              or all files, with granular permissions for viewing, downloading, and editing.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            flex: '1',
            maxWidth: '400px'
          }}>
            <Search size={18} style={{ color: '#6b7280' }} />
            <input
              type="text"
              placeholder="Search tokens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: 'none',
                background: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            <Plus size={18} />
            Create Token
          </button>
        </div>

        {/* Tokens List */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <RefreshCw size={32} style={{ color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
              <AlertCircle size={32} style={{ marginBottom: '0.5rem' }} />
              <p>{error}</p>
            </div>
          ) : filteredTokens.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
              <Key size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p style={{ margin: 0 }}>No access tokens created yet</p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
                Create a token to provide external access to your files
              </p>
            </div>
          ) : (
            <div>
              {filteredTokens.map((token) => (
                <div
                  key={token.id}
                  style={{
                    padding: '1.25rem',
                    borderBottom: '1px solid #f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: token.is_active ? '#ede9fe' : '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Key size={24} style={{ color: token.is_active ? '#8b5cf6' : '#9ca3af' }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>{token.name}</h3>
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.625rem',
                        fontWeight: '600',
                        backgroundColor: token.is_active ? '#dcfce7' : '#fef2f2',
                        color: token.is_active ? '#16a34a' : '#dc2626',
                        textTransform: 'uppercase'
                      }}>
                        {token.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      marginTop: '0.375rem',
                      fontSize: '0.75rem',
                      color: '#6b7280'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {getScopeIcon(token.scope_type)}
                        {token.scope_type === 'all' ? 'All files' :
                         token.scope_type === 'folder' ? `${token.folder_ids?.length || 0} folders` :
                         `${token.file_ids?.length || 0} files`}
                      </span>
                      <span>|</span>
                      <span style={{ fontFamily: 'monospace' }}>{token.token_prefix}...</span>
                      <span>|</span>
                      <span>{token.usage_count} uses</span>
                      {token.max_downloads && (
                        <>
                          <span>|</span>
                          <span>{token.current_downloads}/{token.max_downloads} downloads</span>
                        </>
                      )}
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '0.5rem',
                      marginTop: '0.5rem'
                    }}>
                      {token.can_view && (
                        <span style={{
                          padding: '0.125rem 0.375rem',
                          backgroundColor: '#dbeafe',
                          color: '#1d4ed8',
                          borderRadius: '4px',
                          fontSize: '0.625rem',
                          fontWeight: '500'
                        }}>
                          View
                        </span>
                      )}
                      {token.can_download && (
                        <span style={{
                          padding: '0.125rem 0.375rem',
                          backgroundColor: '#dcfce7',
                          color: '#16a34a',
                          borderRadius: '4px',
                          fontSize: '0.625rem',
                          fontWeight: '500'
                        }}>
                          Download
                        </span>
                      )}
                      {token.can_edit && (
                        <span style={{
                          padding: '0.125rem 0.375rem',
                          backgroundColor: '#fef3c7',
                          color: '#d97706',
                          borderRadius: '4px',
                          fontSize: '0.625rem',
                          fontWeight: '500'
                        }}>
                          Edit
                        </span>
                      )}
                      {token.can_delete && (
                        <span style={{
                          padding: '0.125rem 0.375rem',
                          backgroundColor: '#fecaca',
                          color: '#dc2626',
                          borderRadius: '4px',
                          fontSize: '0.625rem',
                          fontWeight: '500'
                        }}>
                          Delete
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleToggleActive(token)}
                        style={{
                          padding: '0.375rem',
                          background: 'none',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: token.is_active ? '#16a34a' : '#6b7280'
                        }}
                        title={token.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {token.is_active ? <Check size={16} /> : <X size={16} />}
                      </button>
                      <button
                        onClick={() => openEditModal(token)}
                        style={{
                          padding: '0.375rem',
                          background: 'none',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#6b7280'
                        }}
                        title="Edit token"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteToken(token)}
                        style={{
                          padding: '0.375rem',
                          background: 'none',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#dc2626'
                        }}
                        title="Delete token"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      <Clock size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                      Last used: {formatDate(token.last_used_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Token Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {newTokenValue ? (
              // Token Created Success View
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}>
                  <Check size={32} style={{ color: '#16a34a' }} />
                </div>
                <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Token Created!</h2>
                <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                  Copy this token now. It will not be shown again.
                </p>
                <div style={{
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  wordBreak: 'break-all',
                  marginBottom: '1rem'
                }}>
                  {newTokenValue}
                </div>
                <button
                  onClick={copyTokenToClipboard}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: copiedToken ? '#16a34a' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    margin: '0 auto 1rem'
                  }}
                >
                  {copiedToken ? <Check size={18} /> : <Copy size={18} />}
                  {copiedToken ? 'Copied!' : 'Copy Token'}
                </button>
                <button
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              // Create Form
              <>
                <div style={{
                  padding: '1.5rem',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Create Access Token</h2>
                  <button
                    onClick={() => { setShowCreateModal(false); resetForm(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                      Token Name *
                    </label>
                    <input
                      type="text"
                      value={tokenForm.name}
                      onChange={(e) => setTokenForm({ ...tokenForm, name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                      placeholder="e.g., External Partner Access"
                    />
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                      Access Scope
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {[
                        { value: 'all', label: 'All Files', icon: <Globe size={16} /> },
                        { value: 'folder', label: 'Specific Folders', icon: <FolderOpen size={16} /> },
                        { value: 'specific', label: 'Specific Files', icon: <FileText size={16} /> }
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setTokenForm({ ...tokenForm, scope_type: option.value as any })}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '1rem',
                            border: tokenForm.scope_type === option.value ? '2px solid #8b5cf6' : '1px solid #e5e7eb',
                            borderRadius: '8px',
                            backgroundColor: tokenForm.scope_type === option.value ? '#f5f3ff' : 'white',
                            cursor: 'pointer'
                          }}
                        >
                          {option.icon}
                          <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                      Permissions
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {[
                        { key: 'can_view', label: 'View' },
                        { key: 'can_download', label: 'Download' },
                        { key: 'can_edit', label: 'Edit' },
                        { key: 'can_delete', label: 'Delete' },
                        { key: 'can_share', label: 'Share' }
                      ].map((perm) => (
                        <label
                          key={perm.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            backgroundColor: (tokenForm as any)[perm.key] ? '#f5f3ff' : 'white'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={(tokenForm as any)[perm.key]}
                            onChange={(e) => setTokenForm({ ...tokenForm, [perm.key]: e.target.checked })}
                          />
                          <span style={{ fontSize: '0.875rem' }}>{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                        Max Downloads (optional)
                      </label>
                      <input
                        type="number"
                        value={tokenForm.max_downloads || ''}
                        onChange={(e) => setTokenForm({ ...tokenForm, max_downloads: parseInt(e.target.value) || undefined })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '0.875rem'
                        }}
                        placeholder="Unlimited"
                        min={1}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                        Expires In (days)
                      </label>
                      <input
                        type="number"
                        value={tokenForm.expires_days || ''}
                        onChange={(e) => setTokenForm({ ...tokenForm, expires_days: parseInt(e.target.value) || undefined })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '0.875rem'
                        }}
                        placeholder="Never expires"
                        min={1}
                      />
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem'
                }}>
                  <button
                    onClick={() => { setShowCreateModal(false); resetForm(); }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#f3f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateToken}
                    disabled={actionLoading || !tokenForm.name}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      opacity: actionLoading || !tokenForm.name ? 0.7 : 1
                    }}
                  >
                    {actionLoading ? 'Creating...' : 'Create Token'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Token Modal */}
      {showEditModal && selectedToken && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Edit Token</h2>
              <button
                onClick={() => { setShowEditModal(false); setSelectedToken(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Token Name
                </label>
                <input
                  type="text"
                  value={tokenForm.name}
                  onChange={(e) => setTokenForm({ ...tokenForm, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Permissions
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {[
                    { key: 'can_view', label: 'View' },
                    { key: 'can_download', label: 'Download' },
                    { key: 'can_edit', label: 'Edit' },
                    { key: 'can_delete', label: 'Delete' },
                    { key: 'can_share', label: 'Share' }
                  ].map((perm) => (
                    <label
                      key={perm.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: (tokenForm as any)[perm.key] ? '#f5f3ff' : 'white'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={(tokenForm as any)[perm.key]}
                        onChange={(e) => setTokenForm({ ...tokenForm, [perm.key]: e.target.checked })}
                      />
                      <span style={{ fontSize: '0.875rem' }}>{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Max Downloads
                </label>
                <input
                  type="number"
                  value={tokenForm.max_downloads || ''}
                  onChange={(e) => setTokenForm({ ...tokenForm, max_downloads: parseInt(e.target.value) || undefined })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem'
                  }}
                  placeholder="Unlimited"
                  min={1}
                />
              </div>
            </div>
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}>
              <button
                onClick={() => { setShowEditModal(false); setSelectedToken(null); }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateToken}
                disabled={actionLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  opacity: actionLoading ? 0.7 : 1
                }}
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
