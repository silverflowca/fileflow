import { useState, useCallback } from 'react'
import { X, GripVertical, FileText, Trash2, ArrowUp, ArrowDown, Info } from 'lucide-react'
import { File as FileType } from '../../types/files'
import { formatFileSize } from '../../lib/supabase'
import api from '../../lib/api'

interface PDFMergeModalProps {
  isOpen: boolean
  onClose: () => void
  files: FileType[]
  currentFolderId: string | null
  onMergeComplete: () => void
}

interface DragItem {
  id: string
  index: number
}

export default function PDFMergeModal({
  isOpen,
  onClose,
  files,
  currentFolderId,
  onMergeComplete
}: PDFMergeModalProps) {
  // Filter to only PDF files
  const pdfFiles = files.filter(f => f.file_type.includes('pdf'))

  const [selectedFiles, setSelectedFiles] = useState<FileType[]>([])
  const [outputName, setOutputName] = useState('merged_document')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [showSourceInfo, setShowSourceInfo] = useState(false)

  const handleFileToggle = (file: FileType) => {
    setSelectedFiles(prev => {
      const exists = prev.find(f => f.id === file.id)
      if (exists) {
        return prev.filter(f => f.id !== file.id)
      }
      return [...prev, file]
    })
  }

  const handleRemoveFile = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const moveFile = (fromIndex: number, toIndex: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev]
      const [movedFile] = newFiles.splice(fromIndex, 1)
      newFiles.splice(toIndex, 0, movedFile)
      return newFiles
    })
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number, fileId: string) => {
    setDraggedItem({ id: fileId, index })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', fileId)
    // Add a slight delay to show the drag effect
    const target = e.currentTarget as HTMLElement
    setTimeout(() => {
      target.style.opacity = '0.5'
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement
    target.style.opacity = '1'
    setDraggedItem(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedItem && draggedItem.index !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedItem && draggedItem.index !== dropIndex) {
      moveFile(draggedItem.index, dropIndex)
    }
    setDraggedItem(null)
    setDragOverIndex(null)
  }

  const handleMerge = async () => {
    if (selectedFiles.length < 2) {
      setError('Select at least 2 PDF files to merge')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await api.mergePdf({
        file_ids: selectedFiles.map(f => f.id),
        output_name: outputName,
        folder_id: currentFolderId
      })

      if (result.success) {
        onMergeComplete()
        onClose()
        // Reset state
        setSelectedFiles([])
        setOutputName('merged_document')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to merge PDFs')
    } finally {
      setIsLoading(false)
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
        maxWidth: '800px',
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
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
              Merge PDF Files
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Select and arrange PDFs in the order you want them merged
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* Available PDFs */}
          <div style={{
            width: '50%',
            borderRight: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb'
            }}>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600' }}>
                Available PDFs ({pdfFiles.length})
              </h3>
            </div>
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '0.5rem'
            }}>
              {pdfFiles.length === 0 ? (
                <p style={{
                  textAlign: 'center',
                  color: '#6b7280',
                  padding: '2rem',
                  fontSize: '0.875rem'
                }}>
                  No PDF files in current folder
                </p>
              ) : (
                pdfFiles.map(file => {
                  const isSelected = selectedFiles.some(f => f.id === file.id)
                  return (
                    <div
                      key={file.id}
                      onClick={() => handleFileToggle(file)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? '#dbeafe' : '#f9fafb',
                        border: `2px solid ${isSelected ? '#3b82f6' : 'transparent'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <FileText size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0,
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {file.name}
                        </p>
                        <p style={{
                          margin: 0,
                          fontSize: '0.75rem',
                          color: '#6b7280'
                        }}>
                          {formatFileSize(file.size_bytes)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Selected PDFs (Drag to reorder) */}
          <div style={{
            width: '50%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb'
            }}>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600' }}>
                Merge Order ({selectedFiles.length} selected)
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                Drag to reorder
              </p>
            </div>
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '0.5rem'
            }}>
              {selectedFiles.length === 0 ? (
                <p style={{
                  textAlign: 'center',
                  color: '#6b7280',
                  padding: '2rem',
                  fontSize: '0.875rem'
                }}>
                  Select PDFs from the left to add them here
                </p>
              ) : (
                selectedFiles.map((file, index) => (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index, file.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      borderRadius: '8px',
                      backgroundColor: dragOverIndex === index ? '#dbeafe' : 'white',
                      border: `2px solid ${dragOverIndex === index ? '#3b82f6' : '#e5e7eb'}`,
                      cursor: 'grab',
                      transition: 'all 0.15s'
                    }}
                  >
                    <GripVertical size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />
                    <span style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </span>
                    <FileText size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {file.name}
                      </p>
                      <p style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>
                        {formatFileSize(file.size_bytes)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); index > 0 && moveFile(index, index - 1) }}
                        disabled={index === 0}
                        style={{
                          padding: '0.25rem',
                          background: 'none',
                          border: 'none',
                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                          opacity: index === 0 ? 0.3 : 1,
                          borderRadius: '4px'
                        }}
                        title="Move up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); index < selectedFiles.length - 1 && moveFile(index, index + 1) }}
                        disabled={index === selectedFiles.length - 1}
                        style={{
                          padding: '0.25rem',
                          background: 'none',
                          border: 'none',
                          cursor: index === selectedFiles.length - 1 ? 'not-allowed' : 'pointer',
                          opacity: index === selectedFiles.length - 1 ? 0.3 : 1,
                          borderRadius: '4px'
                        }}
                        title="Move down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveFile(file.id) }}
                        style={{
                          padding: '0.25rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#ef4444',
                          borderRadius: '4px'
                        }}
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb'
        }}>
          {/* Output filename */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              marginBottom: '0.5rem'
            }}>
              Output filename
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="merged_document"
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.875rem'
                }}
              />
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>.pdf</span>
            </div>
          </div>

          {/* Info about source file preservation */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            padding: '0.75rem',
            backgroundColor: '#dbeafe',
            borderRadius: '6px',
            marginBottom: '1rem'
          }}>
            <Info size={16} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#1e40af' }}>
              Source file information (names, sizes, page ranges) will be preserved in the merged PDF's metadata and can be viewed in the file details panel.
            </p>
          </div>

          {error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={selectedFiles.length < 2 || isLoading}
              style={{
                padding: '0.5rem 1.5rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: selectedFiles.length < 2 || isLoading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                cursor: selectedFiles.length < 2 || isLoading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              {isLoading ? 'Merging...' : `Merge ${selectedFiles.length} PDFs`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
