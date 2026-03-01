import { useState } from 'react';
import {
  FileText,
  Globe,
  Scan,
  Languages,
  Loader2,
  Check,
  X,
  ChevronDown,
  Download,
  Copy
} from 'lucide-react';
import { documentProcessing } from '../../lib/documentProcessing';

interface FileInfo {
  id: string;
  name: string;
  mime_type: string;
}

interface DocumentActionsPanelProps {
  file: FileInfo;
  onActionComplete?: (action: string, result: any) => void;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

const SUPPORTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/html',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/tiff'
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh-Hans', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' }
];

export function DocumentActionsPanel({ file, onActionComplete }: DocumentActionsPanelProps) {
  const [extractStatus, setExtractStatus] = useState<ActionStatus>('idle');
  const [ocrStatus, setOcrStatus] = useState<ActionStatus>('idle');
  const [translateStatus, setTranslateStatus] = useState<ActionStatus>('idle');
  const [detectStatus, setDetectStatus] = useState<ActionStatus>('idle');

  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<{ code: string; confidence: number } | null>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translatedPdfUrl, setTranslatedPdfUrl] = useState<string | null>(null);

  const [targetLanguage, setTargetLanguage] = useState('en');
  const [showTranslateOptions, setShowTranslateOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported = SUPPORTED_TYPES.includes(file.mime_type);

  // Load settings from localStorage
  const getSettings = () => {
    const saved = localStorage.getItem('documentProcessingSettings');
    return saved ? JSON.parse(saved) : {
      enableOcr: true,
      enableTranslation: true,
      enableExtraction: true,
      preserveFormulas: true,
      preserveNumbers: true,
      translatePdfMode: 'overlay'
    };
  };

  const handleExtract = async () => {
    setExtractStatus('loading');
    setError(null);
    try {
      const result = await documentProcessing.extract(file.id);
      setExtractedText(result.extracted?.full_text || '');
      setDetectedLanguage(result.detectedLanguage);
      setExtractStatus('success');
      onActionComplete?.('extract', result);
    } catch (err: any) {
      setError(err.message);
      setExtractStatus('error');
    }
  };

  const handleOcr = async () => {
    setOcrStatus('loading');
    setError(null);
    try {
      const settings = getSettings();
      const result = await documentProcessing.ocr(file.id, {
        language: settings.defaultOcrLanguage || 'eng',
        mode: 'on'
      });
      setExtractedText(result.extracted?.full_text || '');
      setDetectedLanguage(result.detectedLanguage);
      setOcrStatus('success');
      onActionComplete?.('ocr', result);
    } catch (err: any) {
      setError(err.message);
      setOcrStatus('error');
    }
  };

  const handleDetectLanguage = async () => {
    setDetectStatus('loading');
    setError(null);
    try {
      const result = await documentProcessing.detectLanguage(file.id);
      setDetectedLanguage({ code: result.language, confidence: result.confidence });
      setDetectStatus('success');
      onActionComplete?.('detect-language', result);
    } catch (err: any) {
      setError(err.message);
      setDetectStatus('error');
    }
  };

  const handleTranslate = async () => {
    setTranslateStatus('loading');
    setError(null);
    try {
      const settings = getSettings();
      const result = await documentProcessing.translate(file.id, {
        targetLanguage,
        pdfMode: settings.translatePdfMode,
        preserveNumbers: settings.preserveNumbers,
        preserveFormulas: settings.preserveFormulas
      });
      setTranslatedText(result.translated?.full_text || '');
      if (result.artifacts?.translated_pdf) {
        setTranslatedPdfUrl(result.artifacts.translated_pdf);
      }
      setTranslateStatus('success');
      onActionComplete?.('translate', result);
    } catch (err: any) {
      setError(err.message);
      setTranslateStatus('error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!isSupported) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-500">
          Document processing is not available for this file type.
        </p>
      </div>
    );
  }

  const settings = getSettings();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{
        fontWeight: '500',
        color: '#111827',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <FileText style={{ width: '1rem', height: '1rem' }} />
        Document Actions
      </h3>

      {error && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#fef2f2',
          color: '#b91c1c',
          borderRadius: '8px',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <X style={{ width: '1rem', height: '1rem' }} />
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.5rem'
      }}>
        {/* Extract Text */}
        {settings.enableExtraction && (
          <button
            onClick={handleExtract}
            disabled={extractStatus === 'loading'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem',
              cursor: extractStatus === 'loading' ? 'not-allowed' : 'pointer',
              opacity: extractStatus === 'loading' ? 0.5 : 1
            }}
          >
            {extractStatus === 'loading' ? (
              <Loader2 style={{ width: '1rem', height: '1rem' }} />
            ) : extractStatus === 'success' ? (
              <Check style={{ width: '1rem', height: '1rem', color: '#16a34a' }} />
            ) : (
              <FileText style={{ width: '1rem', height: '1rem' }} />
            )}
            Extract Text
          </button>
        )}

        {/* OCR */}
        {settings.enableOcr && (
          <button
            onClick={handleOcr}
            disabled={ocrStatus === 'loading'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem',
              cursor: ocrStatus === 'loading' ? 'not-allowed' : 'pointer',
              opacity: ocrStatus === 'loading' ? 0.5 : 1
            }}
          >
            {ocrStatus === 'loading' ? (
              <Loader2 style={{ width: '1rem', height: '1rem' }} />
            ) : ocrStatus === 'success' ? (
              <Check style={{ width: '1rem', height: '1rem', color: '#16a34a' }} />
            ) : (
              <Scan style={{ width: '1rem', height: '1rem' }} />
            )}
            Run OCR
          </button>
        )}

        {/* Detect Language */}
        <button
          onClick={handleDetectLanguage}
          disabled={detectStatus === 'loading'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '0.875rem',
            cursor: detectStatus === 'loading' ? 'not-allowed' : 'pointer',
            opacity: detectStatus === 'loading' ? 0.5 : 1
          }}
        >
          {detectStatus === 'loading' ? (
            <Loader2 style={{ width: '1rem', height: '1rem' }} />
          ) : detectStatus === 'success' ? (
            <Check style={{ width: '1rem', height: '1rem', color: '#16a34a' }} />
          ) : (
            <Globe style={{ width: '1rem', height: '1rem' }} />
          )}
          Detect Language
        </button>

        {/* Translate */}
        {settings.enableTranslation && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTranslateOptions(!showTranslateOptions)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              <Languages style={{ width: '1rem', height: '1rem' }} />
              Translate
              <ChevronDown style={{ width: '0.75rem', height: '0.75rem' }} />
            </button>

            {showTranslateOptions && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '0.25rem',
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                zIndex: 10,
                padding: '0.75rem'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.25rem'
                }}>
                  Target Language
                </label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.375rem 0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem'
                  }}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setShowTranslateOptions(false);
                    handleTranslate();
                  }}
                  disabled={translateStatus === 'loading'}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.375rem 0.75rem',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    cursor: translateStatus === 'loading' ? 'not-allowed' : 'pointer',
                    opacity: translateStatus === 'loading' ? 0.5 : 1
                  }}
                >
                  {translateStatus === 'loading' ? (
                    <Loader2 style={{ width: '1rem', height: '1rem' }} />
                  ) : (
                    'Translate Now'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {detectedLanguage && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#eff6ff',
          borderRadius: '8px'
        }}>
          <p style={{ fontSize: '0.875rem' }}>
            <span style={{ fontWeight: '500' }}>Detected Language:</span>{' '}
            {LANGUAGES.find(l => l.code === detectedLanguage.code)?.name || detectedLanguage.code}
            <span style={{ color: '#6b7280', marginLeft: '0.25rem' }}>
              ({Math.round(detectedLanguage.confidence * 100)}% confidence)
            </span>
          </p>
        </div>
      )}

      {extractedText && (
        <div style={{
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.75rem',
            backgroundColor: '#f9fafb',
            borderBottom: '1px solid #d1d5db'
          }}>
            <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Extracted Text</span>
            <button
              onClick={() => copyToClipboard(extractedText)}
              style={{
                padding: '0.25rem',
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              title="Copy to clipboard"
            >
              <Copy style={{ width: '1rem', height: '1rem' }} />
            </button>
          </div>
          <div style={{
            padding: '0.75rem',
            maxHeight: '12rem',
            overflowY: 'auto'
          }}>
            <pre style={{
              fontSize: '0.75rem',
              color: '#374151',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              margin: 0
            }}>
              {extractedText.slice(0, 2000)}
              {extractedText.length > 2000 && '...'}
            </pre>
          </div>
        </div>
      )}

      {translatedText && (
        <div style={{
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.75rem',
            backgroundColor: '#f0fdf4',
            borderBottom: '1px solid #d1d5db'
          }}>
            <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Translated Text</span>
            <button
              onClick={() => copyToClipboard(translatedText)}
              style={{
                padding: '0.25rem',
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              title="Copy to clipboard"
            >
              <Copy style={{ width: '1rem', height: '1rem' }} />
            </button>
          </div>
          <div style={{
            padding: '0.75rem',
            maxHeight: '12rem',
            overflowY: 'auto'
          }}>
            <pre style={{
              fontSize: '0.75rem',
              color: '#374151',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              margin: 0
            }}>
              {translatedText.slice(0, 2000)}
              {translatedText.length > 2000 && '...'}
            </pre>
          </div>
        </div>
      )}

      {translatedPdfUrl && (
        <a
          href={translatedPdfUrl}
          download
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: '0.5rem 0.75rem',
            backgroundColor: '#16a34a',
            color: 'white',
            borderRadius: '8px',
            fontSize: '0.875rem',
            textDecoration: 'none'
          }}
        >
          <Download style={{ width: '1rem', height: '1rem' }} />
          Download Translated PDF
        </a>
      )}
    </div>
  );
}

export default DocumentActionsPanel;
