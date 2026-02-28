import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderPlus, Upload, Home, ChevronRight, Mic, Video, PenTool, Info, Combine, LayoutGrid, List, Shield, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useFiles } from '../contexts/FileContext'
import { useUpload } from '../contexts/UploadContext'
import { formatFileSize } from '../lib/supabase'
import { downloadFile } from '../lib/fileUtils'
import FolderGrid from '../components/folders/FolderGrid'
import CreateFolderModal from '../components/folders/CreateFolderModal'
import FileUpload from '../components/files/FileUpload'
import FilePreviewModal from '../components/files/FilePreviewModal'
import FileDetailsPanel from '../components/files/FileDetailsPanel'
import PDFMergeModal from '../components/files/PDFMergeModal'
import FileSignaturesModal from '../components/files/FileSignaturesModal'
import QuickSignatureModal from '../components/files/QuickSignatureModal'
import AudioRecorder from '../components/audio/AudioRecorder'
import { VideoRecorder } from '../components/video'
import DocumentProcessingSettings from '../components/files/DocumentProcessingSettings'
import { File as FileType, ViewMode } from '../types/files'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const {
    currentFolder,
    currentFolderId,
    folders,
    files,
    foldersLoading,
    filesLoading,
    createFolder,
    deleteFolder,
    deleteFile,
    navigateToFolder,
    refresh,
  } = useFiles()

  const { uploadFile } = useUpload()

  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [showAudioRecorder, setShowAudioRecorder] = useState(false)
  const [showVideoRecorder, setShowVideoRecorder] = useState(false)
  const [showDocProcessingSettings, setShowDocProcessingSettings] = useState(false)
  const [showPdfMerge, setShowPdfMerge] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileType | null>(null)
  const [detailsFile, setDetailsFile] = useState<FileType | null>(null)
  const [signaturesFile, setSignaturesFile] = useState<FileType | null>(null)
  const [quickSignatureFile, setQuickSignatureFile] = useState<FileType | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('fileflow_view_mode')
    return (saved === 'list' || saved === 'grid') ? saved : 'grid'
  })

  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem('fileflow_view_mode', viewMode)
  }, [viewMode])

  const handleCreateFolder = async (name: string) => {
    await createFolder(name)
  }

  const handleUploadFiles = async (fileList: FileList) => {
    const filesArray = Array.from(fileList)
    for (const file of filesArray) {
      await uploadFile(file, currentFolderId)
    }
    setShowFileUpload(false)
  }

  const handleFolderAction = async (folder: any, action: string) => {
    if (action === 'menu') {
      const confirmed = window.confirm(`Delete folder "${folder.name}"?`)
      if (confirmed) {
        await deleteFolder(folder.id)
      }
    }
  }

  const handleFileAction = async (file: any, action: string) => {
    if (action === 'menu') {
      const confirmed = window.confirm(`Delete file "${file.name}"?`)
      if (confirmed) {
        await deleteFile(file.id)
      }
    } else if (action === 'details') {
      setDetailsFile(file)
    } else if (action === 'esignature') {
      setSignaturesFile(file)
    }
  }

  const handleCreateSignatureFromFile = () => {
    if (signaturesFile) {
      setQuickSignatureFile(signaturesFile)
      setSignaturesFile(null)
    }
  }

  const handleDownloadFile = async (file: FileType) => {
    try {
      await downloadFile(file.storage_path, file.bucket_name, file.name)
    } catch (error) {
      console.error('Download error:', error)
      alert('Failed to download file')
    }
  }

  const handleSaveAudioRecording = async (audioBlob: Blob, fileName: string) => {
    const file = new File([audioBlob], fileName, { type: 'audio/webm' })
    await uploadFile(file, currentFolderId)
  }

  const handleSaveVideoRecording = async (videoBlob: Blob, fileName: string) => {
    const file = new File([videoBlob], fileName, { type: 'video/webm' })
    await uploadFile(file, currentFolderId)
  }

  const isLoading = foldersLoading || filesLoading

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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>FileFlow</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {profile && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: '500', margin: 0 }}>{profile.display_name}</p>
                <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>
                  {formatFileSize(profile.storage_used_bytes)} / {formatFileSize(profile.storage_quota_bytes)}
                </p>
              </div>
            )}
            {profile?.role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                <Shield size={16} />
                Admin
              </button>
            )}
            <button
            <button
              onClick={() => setShowDocProcessingSettings(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Settings size={16} />
              Doc Processing
            </button>
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
        {/* Toolbar */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => navigateToFolder(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: currentFolder ? '400' : '600'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Home size={16} />
              My Files
            </button>

            {currentFolder && (
              <>
                <ChevronRight size={16} style={{ color: '#9ca3af' }} />
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#111827'
                }}>
                  {currentFolder.name}
                </span>
              </>
            )}
          </div>

          {/* View Toggle & Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {/* View Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: '#f3f4f6',
              borderRadius: '6px',
              padding: '2px'
            }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.375rem 0.5rem',
                  backgroundColor: viewMode === 'grid' ? 'white' : 'transparent',
                  color: viewMode === 'grid' ? '#111827' : '#6b7280',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s'
                }}
                title="Grid view"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.375rem 0.5rem',
                  backgroundColor: viewMode === 'list' ? 'white' : 'transparent',
                  color: viewMode === 'list' ? '#111827' : '#6b7280',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s'
                }}
                title="List view"
              >
                <List size={18} />
              </button>
            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb' }} />

            <button
              onClick={() => setShowCreateFolderModal(true)}
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
                cursor: 'pointer',
              }}
            >
              <FolderPlus size={16} />
              New Folder
            </button>

            <button
              onClick={() => setShowFileUpload(!showFileUpload)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: showFileUpload ? '#f3f4f6' : '#10b981',
                color: showFileUpload ? '#111827' : 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              <Upload size={16} />
              {showFileUpload ? 'Cancel Upload' : 'Upload Files'}
            </button>

            <button
              onClick={() => setShowAudioRecorder(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              <Mic size={16} />
              Record Audio
            </button>

            <button
              onClick={() => setShowVideoRecorder(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#f97316',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              <Video size={16} />
              Record Video
            </button>

            <button
              onClick={() => navigate('/esignature')}
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
                cursor: 'pointer',
              }}
            >
              <PenTool size={16} />
              E-Signatures
            </button>

            <button
              onClick={() => setShowPdfMerge(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#0891b2',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              <Combine size={16} />
              Merge PDFs
            </button>
          </div>
        </div>

        {/* Upload Area */}
        {showFileUpload && (
          <div style={{ marginBottom: '1rem' }}>
            <FileUpload onUpload={handleUploadFiles} />
          </div>
        )}

        {/* Content */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          minHeight: '400px'
        }}>
          {isLoading ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              Loading...
            </div>
          ) : (
            <FolderGrid
              folders={folders}
              files={files}
              onFolderClick={navigateToFolder}
              onFileClick={(file) => setPreviewFile(file)}
              onFolderAction={handleFolderAction}
              onFileAction={handleFileAction}
              viewMode={viewMode}
            />
          )}
        </div>
      </main>

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={showCreateFolderModal}
        onClose={() => setShowCreateFolderModal(false)}
        onSubmit={handleCreateFolder}
        parentFolderName={currentFolder?.name || 'My Files'}
      />

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownloadFile}
      />

      {/* Audio Recorder Modal */}
      {showAudioRecorder && (
        <AudioRecorder
          onSave={handleSaveAudioRecording}
          onClose={() => setShowAudioRecorder(false)}
        />
      )}

      {/* Video Recorder Modal */}
      {showVideoRecorder && (
        <VideoRecorder
          onSave={handleSaveVideoRecording}
          onClose={() => setShowVideoRecorder(false)}
        />
      )}

      {/* File Details Panel */}
      {detailsFile && (
        <FileDetailsPanel
          file={detailsFile}
          isOpen={!!detailsFile}
          onClose={() => setDetailsFile(null)}
          onDownload={handleDownloadFile}
        />
      )}

      {/* PDF Merge Modal */}
      <PDFMergeModal
        isOpen={showPdfMerge}
        onClose={() => setShowPdfMerge(false)}
        files={files}
        currentFolderId={currentFolderId}
        onMergeComplete={refresh}
      />

      {/* File Signatures Modal */}
      {signaturesFile && (
        <FileSignaturesModal
          file={signaturesFile}
          isOpen={!!signaturesFile}
          onClose={() => setSignaturesFile(null)}
          onCreateNew={handleCreateSignatureFromFile}
        />
      )}

      {/* Quick Signature Modal */}
      {quickSignatureFile && (
        <QuickSignatureModal
          file={quickSignatureFile}
          isOpen={!!quickSignatureFile}
          onClose={() => setQuickSignatureFile(null)}
          onSuccess={() => {
            refresh()
            setQuickSignatureFile(null)
          }}
        />
      )}
      <DocumentProcessingSettings
        isOpen={showDocProcessingSettings}
        onClose={() => setShowDocProcessingSettings(false)}
      />
    </div>
  )
}
