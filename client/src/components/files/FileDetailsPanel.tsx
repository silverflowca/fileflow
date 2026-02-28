import { useState, useEffect } from 'react'
import {
  X, Download, Share2, Link, Copy, Check, Trash2,
  Eye, Edit3, Lock, Calendar, Clock, FileText,
  ExternalLink, Key, Users, History, Combine
} from 'lucide-react'
import { File as FileType } from '../../types/files'
import { formatFileSize } from '../../lib/supabase'
import api from '../../lib/api'
import { DocumentActionsPanel } from './DocumentActionsPanel'

interface FileDetailsPanelProps {
  file: FileType
  isOpen: boolean
  onClose: () => void
  onDownload: (file: FileType) => void
}

interface FileDetails {
  urls: {
    download: string
    internal: string
    view: string
    embed: string
  }
  sharing: {
    publicLinks: any[]
    permissionsCount: number
    isPublic: boolean
  }
  stats: {
    versionsCount: number
    currentVersion: number
  }
  access: {
    isOwner: boolean
    canEdit: boolean
    canShare: boolean
    canDelete: boolean
  }
}

interface ShareLink {
  id: string
  link_token: string
  permission_level: 'viewer' | 'editor'
  expires_at: string | null
  max_access_count: number | null
  current_access_count: number
  requires_password: boolean
  allow_download: boolean
  shareUrl?: string
}

export default function FileDetailsPanel({
  file,
  isOpen,
  onClose,
  onDownload,
}: FileDetailsPanelProps) {
  const [details, setDetails] = useState<FileDetails | null>(null)
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [showCreateLink, setShowCreateLink] = useState(false)
  const [createLinkOptions, setCreateLinkOptions] = useState({
    permission_level: 'viewer' as 'viewer' | 'editor',
    allow_download: true,
    expires_in_days: 0,
    requires_password: false,
    password: '',
  })
  const [creatingLink, setCreatingLink] = useState(false)
  const [newLinkUrl, setNewLinkUrl] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && file) {
      loadFileDetails()
      loadLinks()
    }
  }, [isOpen, file?.id])

  const loadFileDetails = async () => {
    try {
      setLoading(true)
      const data = await api.getFileDetails(file.id)
      setDetails(data)
    } catch (err) {
      console.error('Failed to load file details:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadLinks = async () => {
    try {
      const data = await api.getFileLinks(file.id)
      setLinks(data)
    } catch (err) {
      console.error('Failed to load links:', err)
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedUrl(label)
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleCreateLink = async () => {
    setCreatingLink(true)
    try {
      const options: any = {
        permission_level: createLinkOptions.permission_level,
        allow_download: createLinkOptions.allow_download,
      }

      if (createLinkOptions.expires_in_days > 0) {
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + createLinkOptions.expires_in_days)
        options.expires_at = expiresAt.toISOString()
      }

      if (createLinkOptions.requires_password && createLinkOptions.password) {
        options.requires_password = true
        options.password = createLinkOptions.password
      }

      const result = await api.createFileLink(file.id, options)
      setNewLinkUrl(result.shareUrl)
      loadLinks()
    } catch (err) {
      console.error('Failed to create link:', err)
      alert('Failed to create share link')
    } finally {
      setCreatingLink(false)
    }
  }

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('Delete this share link?')) return
    try {
      await api.deleteFileLink(file.id, linkId)
      loadLinks()
    } catch (err) {
      console.error('Failed to delete link:', err)
    }
  }

  if (!isOpen) return null

  const clientUrl = 'http://localhost:5175'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '450px',
        backgroundColor: 'white',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '1.25rem',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        backgroundColor: '#f9fafb',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {file.name}
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
            File Details
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '0.5rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '6px',
            marginLeft: '1rem',
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem' }}>
        {loading ? (
          <p style={{ color: '#6b7280', textAlign: 'center' }}>Loading...</p>
        ) : (
          <>
            {/* Basic Info */}
            <section style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
                <FileText size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                File Information
              </h3>
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                padding: '1rem',
                fontSize: '0.875rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#6b7280' }}>Size</span>
                  <span style={{ fontWeight: '500' }}>{formatFileSize(file.size_bytes)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#6b7280' }}>Type</span>
                  <span style={{ fontWeight: '500' }}>{file.file_type}</span>
                </div>
                {file.file_extension && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#6b7280' }}>Extension</span>
                    <span style={{ fontWeight: '500' }}>.{file.file_extension}</span>
                  </div>
                )}
                {details?.stats && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#6b7280' }}>Version</span>
                    <span style={{ fontWeight: '500' }}>v{details.stats.currentVersion}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#6b7280' }}>Created</span>
                  <span style={{ fontWeight: '500' }}>{new Date(file.created_at).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Modified</span>
                  <span style={{ fontWeight: '500' }}>{new Date(file.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </section>

            {/* URLs Section */}
            <section style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
                <Link size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                File URLs
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {details?.urls?.download && (
                  <UrlRow
                    label="Download URL"
                    url={details.urls.download}
                    onCopy={() => copyToClipboard(details.urls.download, 'download')}
                    copied={copiedUrl === 'download'}
                  />
                )}
                <UrlRow
                  label="Internal API"
                  url={details?.urls?.internal || `http://localhost:8680/api/storage/download/${file.id}`}
                  onCopy={() => copyToClipboard(details?.urls?.internal || `http://localhost:8680/api/storage/download/${file.id}`, 'internal')}
                  copied={copiedUrl === 'internal'}
                />
                <UrlRow
                  label="View URL"
                  url={`${clientUrl}/files/${file.id}`}
                  onCopy={() => copyToClipboard(`${clientUrl}/files/${file.id}`, 'view')}
                  copied={copiedUrl === 'view'}
                />
              </div>
            </section>

            {/* Sharing Section */}
            <section style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', margin: 0 }}>
                  <Share2 size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                  Share Links
                </h3>
                <button
                  onClick={() => setShowCreateLink(!showCreateLink)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  + Create Link
                </button>
              </div>

              {/* New Link Created */}
              {newLinkUrl && (
                <div style={{
                  backgroundColor: '#dcfce7',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  marginBottom: '0.75rem',
                }}>
                  <p style={{ fontSize: '0.75rem', color: '#166534', fontWeight: '500', margin: '0 0 0.5rem 0' }}>
                    Link created! Copy it now:
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={newLinkUrl}
                      readOnly
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: '1px solid #86efac',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        backgroundColor: 'white',
                      }}
                    />
                    <button
                      onClick={() => {
                        copyToClipboard(newLinkUrl, 'newLink')
                        setNewLinkUrl(null)
                        setShowCreateLink(false)
                      }}
                      style={{
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Create Link Form */}
              {showCreateLink && !newLinkUrl && (
                <div style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '0.75rem',
                }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                      Permission
                    </label>
                    <select
                      value={createLinkOptions.permission_level}
                      onChange={(e) => setCreateLinkOptions({ ...createLinkOptions, permission_level: e.target.value as 'viewer' | 'editor' })}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                      }}
                    >
                      <option value="viewer">View only</option>
                      <option value="editor">Can edit</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={createLinkOptions.allow_download}
                        onChange={(e) => setCreateLinkOptions({ ...createLinkOptions, allow_download: e.target.checked })}
                      />
                      Allow download
                    </label>
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                      Expires in (days, 0 = never)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={createLinkOptions.expires_in_days}
                      onChange={(e) => setCreateLinkOptions({ ...createLinkOptions, expires_in_days: parseInt(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={createLinkOptions.requires_password}
                        onChange={(e) => setCreateLinkOptions({ ...createLinkOptions, requires_password: e.target.checked })}
                      />
                      Require password
                    </label>
                    {createLinkOptions.requires_password && (
                      <input
                        type="password"
                        placeholder="Enter password"
                        value={createLinkOptions.password}
                        onChange={(e) => setCreateLinkOptions({ ...createLinkOptions, password: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          marginTop: '0.5rem',
                        }}
                      />
                    )}
                  </div>

                  <button
                    onClick={handleCreateLink}
                    disabled={creatingLink}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: creatingLink ? 'not-allowed' : 'pointer',
                      opacity: creatingLink ? 0.7 : 1,
                    }}
                  >
                    {creatingLink ? 'Creating...' : 'Create Share Link'}
                  </button>
                </div>
              )}

              {/* Existing Links */}
              {links.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {links.map((link) => (
                    <div
                      key={link.id}
                      style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          {link.permission_level === 'editor' ? (
                            <Edit3 size={14} style={{ color: '#f59e0b' }} />
                          ) : (
                            <Eye size={14} style={{ color: '#6b7280' }} />
                          )}
                          <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                            {link.permission_level === 'editor' ? 'Can Edit' : 'View Only'}
                          </span>
                          {link.requires_password && <Lock size={12} style={{ color: '#6b7280' }} />}
                        </div>
                        <p style={{
                          fontSize: '0.7rem',
                          color: '#6b7280',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {link.current_access_count} views
                          {link.expires_at && ` • Expires ${new Date(link.expires_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(`${clientUrl}/share/${link.link_token}`, link.id)}
                        style={{
                          padding: '0.375rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: '4px',
                        }}
                        title="Copy link"
                      >
                        {copiedUrl === link.id ? <Check size={16} style={{ color: '#16a34a' }} /> : <Copy size={16} />}
                      </button>
                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        style={{
                          padding: '0.375rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          color: '#ef4444',
                        }}
                        title="Delete link"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', textAlign: 'center', padding: '1rem' }}>
                  No share links yet
                </p>
              )}
            </section>

            {/* Access & Stats */}
            {details && (
              <section style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
                  <Users size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                  Access & Stats
                </h3>
                <div style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontSize: '0.875rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#6b7280' }}>Owner</span>
                    <span style={{ fontWeight: '500' }}>{details.access.isOwner ? 'You' : 'Shared'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#6b7280' }}>Shared with</span>
                    <span style={{ fontWeight: '500' }}>{details.sharing.permissionsCount} people</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#6b7280' }}>Public links</span>
                    <span style={{ fontWeight: '500' }}>{details.sharing.publicLinks.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Versions</span>
                    <span style={{ fontWeight: '500' }}>{details.stats.versionsCount}</span>
                  </div>
                </div>
              </section>
            )}

            {/* Document Processing Actions */}
            <section style={{ marginBottom: '1.5rem' }}>
              <DocumentActionsPanel
                file={{
                  id: file.id,
                  name: file.name,
                  mime_type: file.file_type
                }}
              />
            </section>

            {/* Merged PDF Source Files Info */}
            {file.metadata?.merged_from && Array.isArray(file.metadata.merged_from) && (
              <section style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
                  <Combine size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                  Merged From ({file.metadata.merged_from.length} files)
                </h3>
                <div style={{
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  marginBottom: '0.75rem',
                  fontSize: '0.75rem',
                  color: '#0369a1'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span>Total Pages:</span>
                    <span style={{ fontWeight: '600' }}>{file.metadata.total_pages || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Merged On:</span>
                    <span style={{ fontWeight: '600' }}>
                      {file.metadata.merge_date ? new Date(file.metadata.merge_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
                <div style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {file.metadata.merged_from.map((source: any, index: number) => (
                    <div
                      key={source.id || index}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        marginBottom: index < file.metadata.merged_from.length - 1 ? '0.5rem' : 0,
                        backgroundColor: 'white',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <span style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.625rem',
                        fontWeight: '600',
                        flexShrink: 0
                      }}>
                        {index + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0,
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {source.name}
                        </p>
                        <div style={{
                          display: 'flex',
                          gap: '0.75rem',
                          fontSize: '0.7rem',
                          color: '#6b7280',
                          marginTop: '0.25rem'
                        }}>
                          <span>Pages {source.page_range?.start}-{source.page_range?.end}</span>
                          <span>{formatFileSize(source.original_size_bytes)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div style={{
        padding: '1rem 1.25rem',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        gap: '0.75rem',
      }}>
        <button
          onClick={() => onDownload(file)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          <Download size={16} />
          Download
        </button>
        {details?.urls?.view && (
          <button
            onClick={() => window.open(details.urls.view, '_blank')}
            style={{
              padding: '0.75rem',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            <ExternalLink size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

// URL Row Component
function UrlRow({ label, url, onCopy, copied }: { label: string; url: string; onCopy: () => void; copied: boolean }) {
  return (
    <div style={{
      backgroundColor: '#f9fafb',
      borderRadius: '6px',
      padding: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>{label}</span>
        <button
          onClick={onCopy}
          style={{
            padding: '0.25rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.7rem',
            color: copied ? '#16a34a' : '#6b7280',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p style={{
        fontSize: '0.75rem',
        color: '#374151',
        margin: 0,
        wordBreak: 'break-all',
        fontFamily: 'monospace',
        backgroundColor: 'white',
        padding: '0.5rem',
        borderRadius: '4px',
        border: '1px solid #e5e7eb',
      }}>
        {url.length > 60 ? url.substring(0, 60) + '...' : url}
      </p>
    </div>
  )
}
