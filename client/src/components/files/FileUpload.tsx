import { useRef, DragEvent, ChangeEvent } from 'react'
import { Upload } from 'lucide-react'

interface FileUploadProps {
  onUpload: (files: FileList) => Promise<void>
  disabled?: boolean
  accept?: string
  maxSize?: number // in bytes
}

export default function FileUpload({
  onUpload,
  disabled = false,
  accept,
  maxSize = 500 * 1024 * 1024, // 500MB default
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) {
      e.currentTarget.style.borderColor = '#3b82f6'
      e.currentTarget.style.backgroundColor = '#eff6ff'
    }
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.style.borderColor = '#d1d5db'
    e.currentTarget.style.backgroundColor = '#f9fafb'
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.style.borderColor = '#d1d5db'
    e.currentTarget.style.backgroundColor = '#f9fafb'

    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      await handleFiles(files)
    }
  }

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await handleFiles(files)
    }
    // Reset input value so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFiles = async (files: FileList) => {
    // Validate file sizes
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > maxSize) {
        alert(`File "${files[i].name}" is too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`)
        return
      }
    }

    try {
      await onUpload(files)
    } catch (error) {
      console.error('Upload error:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload files')
    }
  }

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: '2px dashed #d1d5db',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: '#f9fafb',
        transition: 'all 0.2s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleFileSelect}
        disabled={disabled}
        style={{ display: 'none' }}
      />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <Upload size={48} style={{ color: '#9ca3af' }} />
        <div>
          <p style={{
            fontSize: '1rem',
            fontWeight: '500',
            color: '#111827',
            margin: '0 0 0.25rem 0'
          }}>
            Drop files here or click to browse
          </p>
          <p style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            margin: 0
          }}>
            Maximum file size: {Math.round(maxSize / 1024 / 1024)}MB
          </p>
        </div>
      </div>
    </div>
  )
}
