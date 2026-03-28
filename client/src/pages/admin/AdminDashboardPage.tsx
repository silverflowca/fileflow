import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Key, FileText, FolderOpen, PenTool, Activity,
  ArrowLeft, Shield, TrendingUp, Clock, AlertCircle, RefreshCw
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../lib/api'
import AiPromptSettings from '../../components/settings/AiPromptSettings'
import EmailSettings from '../../components/settings/EmailSettings'

interface SystemStats {
  users: {
    total: number
    admins: number
    active: number
    suspended: number
  }
  files: {
    total: number
    total_storage_bytes: number
    total_storage_formatted: string
  }
  folders: {
    total: number
  }
  tokens: {
    total: number
    active: number
  }
  signatures: {
    total: number
    completed: number
    pending: number
  }
}

interface AuditLog {
  id: string
  admin_id: string
  action: string
  target_type: string
  target_id: string | null
  created_at: string
  admin?: {
    display_name: string
    email: string
  }
}

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsData, logsData] = await Promise.all([
        api.getAdminStats(),
        api.getAuditLogs(10)
      ])
      setStats(statsData)
      setAuditLogs(logsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getActionColor = (action: string) => {
    if (action.includes('create')) return '#16a34a'
    if (action.includes('delete')) return '#dc2626'
    if (action.includes('update')) return '#f59e0b'
    return '#6b7280'
  }

  if (profile?.role !== 'admin') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Shield size={48} style={{ color: '#dc2626', marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Access Denied
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            You don't have permission to access this area.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Go Back to Dashboard
          </button>
        </div>
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
              onClick={() => navigate('/')}
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
                Admin Dashboard
              </h1>
              <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: 0 }}>
                FileFlow Administration
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0.75rem',
              backgroundColor: '#7c3aed',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: '500'
            }}>
              <Shield size={14} />
              Admin
            </span>
            <span style={{ fontSize: '0.875rem' }}>{profile?.display_name}</span>
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
        {/* Navigation Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <button
            onClick={() => navigate('/admin/users')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1.5rem',
              backgroundColor: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={24} style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <p style={{ fontWeight: '600', margin: 0 }}>User Management</p>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                Create, edit, manage users
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/tokens')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1.5rem',
              backgroundColor: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#8b5cf6'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#ede9fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Key size={24} style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <p style={{ fontWeight: '600', margin: 0 }}>Access Tokens</p>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                Document access & permissions
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/audit')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1.5rem',
              backgroundColor: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#f59e0b'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={24} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <p style={{ fontWeight: '600', margin: 0 }}>Audit Logs</p>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                View admin activity
              </p>
            </div>
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <RefreshCw size={32} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#6b7280', marginTop: '1rem' }}>Loading stats...</p>
          </div>
        ) : error ? (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <AlertCircle size={20} style={{ color: '#dc2626' }} />
            <span style={{ color: '#dc2626' }}>{error}</span>
            <button
              onClick={loadData}
              style={{
                marginLeft: 'auto',
                padding: '0.375rem 0.75rem',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        ) : stats && (
          <>
            {/* Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>Total Users</p>
                    <p style={{ fontSize: '2rem', fontWeight: '700', margin: '0.25rem 0 0' }}>{stats.users.total}</p>
                  </div>
                  <Users size={24} style={{ color: '#3b82f6' }} />
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  <span style={{ color: '#16a34a' }}>{stats.users.active} active</span>
                  {' · '}
                  <span>{stats.users.admins} admins</span>
                </div>
              </div>

              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>Total Files</p>
                    <p style={{ fontSize: '2rem', fontWeight: '700', margin: '0.25rem 0 0' }}>{stats.files.total}</p>
                  </div>
                  <FileText size={24} style={{ color: '#10b981' }} />
                </div>
                <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  {stats.files.total_storage_formatted} used
                </p>
              </div>

              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>Folders</p>
                    <p style={{ fontSize: '2rem', fontWeight: '700', margin: '0.25rem 0 0' }}>{stats.folders.total}</p>
                  </div>
                  <FolderOpen size={24} style={{ color: '#f59e0b' }} />
                </div>
              </div>

              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>Access Tokens</p>
                    <p style={{ fontSize: '2rem', fontWeight: '700', margin: '0.25rem 0 0' }}>{stats.tokens.total}</p>
                  </div>
                  <Key size={24} style={{ color: '#8b5cf6' }} />
                </div>
                <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  <span style={{ color: '#16a34a' }}>{stats.tokens.active} active</span>
                </p>
              </div>

              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>E-Signatures</p>
                    <p style={{ fontSize: '2rem', fontWeight: '700', margin: '0.25rem 0 0' }}>{stats.signatures.total}</p>
                  </div>
                  <PenTool size={24} style={{ color: '#ec4899' }} />
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  <span style={{ color: '#16a34a' }}>{stats.signatures.completed} completed</span>
                  {' · '}
                  <span style={{ color: '#f59e0b' }}>{stats.signatures.pending} pending</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>
                  Recent Admin Activity
                </h2>
                <button
                  onClick={() => navigate('/admin/audit')}
                  style={{
                    fontSize: '0.875rem',
                    color: '#3b82f6',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  View All
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  No recent activity
                </div>
              ) : (
                <div>
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '1rem 1.5rem',
                        borderBottom: '1px solid #f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                      }}
                    >
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: getActionColor(log.action),
                        flexShrink: 0
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.875rem' }}>
                          <strong>{log.admin?.display_name || 'Admin'}</strong>
                          {' '}
                          <span style={{ color: '#6b7280' }}>
                            {log.action.replace('_', ' ')}
                          </span>
                          {' '}
                          <span style={{ color: '#374151' }}>
                            ({log.target_type})
                          </span>
                        </p>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        fontSize: '0.75rem',
                        color: '#9ca3af'
                      }}>
                        <Clock size={12} />
                        {formatDate(log.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Settings Section */}
      <main style={{ maxWidth: '900px', margin: '2rem auto', padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Settings</h2>
          </div>
          <AiPromptSettings />
          <div style={{ borderTop: '1px solid #e5e7eb' }}>
            <EmailSettings />
          </div>
        </div>
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
