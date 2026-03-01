import { useState, useEffect } from 'react';
import { Settings, Globe, FileText, Wand2, X, Check, Loader2 } from 'lucide-react';
import { documentProcessing } from '../../lib/documentProcessing';

interface ProcessingCapabilities {
  supported_file_types: Record<string, string>;
  ocr_languages: string[];
  translation_languages: string[];
  translation_pairs: string[];
  max_upload_size: number;
  converters_available: {
    libreoffice: boolean;
    ocrmypdf: boolean;
  };
}

interface DocumentProcessingSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const LANGUAGE_NAMES: Record<string, string> = {
  'ar': 'Arabic',
  'de': 'German',
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'it': 'Italian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'zh-Hans': 'Chinese (Simplified)',
  'eng': 'English',
  'osd': 'Auto-detect'
};

const OCR_LANGUAGE_NAMES: Record<string, string> = {
  'eng': 'English',
  'spa': 'Spanish',
  'fra': 'French',
  'deu': 'German',
  'ita': 'Italian',
  'por': 'Portuguese',
  'rus': 'Russian',
  'jpn': 'Japanese',
  'kor': 'Korean',
  'chi_sim': 'Chinese (Simplified)',
  'chi_tra': 'Chinese (Traditional)',
  'ara': 'Arabic',
  'osd': 'Auto-detect'
};

export function DocumentProcessingSettings({ isOpen, onClose }: DocumentProcessingSettingsProps) {
  const [capabilities, setCapabilities] = useState<ProcessingCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviceAvailable, setServiceAvailable] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    enableOcr: true,
    enableTranslation: true,
    enableExtraction: true,
    defaultOcrLanguage: 'eng',
    defaultTranslateLanguage: 'en',
    autoDetectLanguage: true,
    preserveFormulas: true,
    preserveNumbers: true,
    translatePdfMode: 'overlay' as 'overlay' | 'append'
  });

  useEffect(() => {
    if (isOpen) {
      loadCapabilities();
      loadSettings();
    }
  }, [isOpen]);

  const loadCapabilities = async () => {
    setLoading(true);
    try {
      const response = await documentProcessing.getCapabilities();
      setCapabilities(response);
      setServiceAvailable(true);
    } catch (error) {
      console.error('Failed to load capabilities:', error);
      setServiceAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = () => {
    const saved = localStorage.getItem('documentProcessingSettings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  };

  const saveSettings = () => {
    localStorage.setItem('documentProcessingSettings', JSON.stringify(settings));
    onClose();
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
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        width: '100%',
        maxWidth: '32rem',
        maxHeight: '90vh',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Settings style={{ width: '1.25rem', height: '1.25rem', color: '#2563eb' }} />
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Document Processing</h2>
          </div>
          <button onClick={onClose} style={{
            padding: '0.25rem',
            borderRadius: '4px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer'
          }}>
            <X style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '1.5rem',
          overflowY: 'auto',
          maxHeight: 'calc(90vh - 140px)'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem 0'
            }}>
              <Loader2 style={{ width: '1.5rem', height: '1.5rem', color: '#2563eb' }} />
              <span style={{ marginLeft: '0.5rem' }}>Loading capabilities...</span>
            </div>
          ) : !serviceAvailable ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.75rem'
              }}>
                <X style={{ width: '1.5rem', height: '1.5rem', color: '#dc2626' }} />
              </div>
              <p style={{ color: '#4b5563' }}>PDFFlow service is not available</p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>Document processing features are disabled</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Service Status */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                color: '#059669',
                backgroundColor: '#f0fdf4',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px'
              }}>
                <Check style={{ width: '1rem', height: '1rem' }} />
                <span>PDFFlow connected</span>
              </div>

              {/* Feature Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{
                  fontWeight: '500',
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Wand2 style={{ width: '1rem', height: '1rem' }} />
                  Features
                </h3>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Text Extraction</span>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Extract text from PDFs and documents</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableExtraction}
                    onChange={(e) => setSettings({ ...settings, enableExtraction: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>OCR Processing</span>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Recognize text in scanned documents</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableOcr}
                    onChange={(e) => setSettings({ ...settings, enableOcr: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Translation</span>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Translate documents to other languages</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableTranslation}
                    onChange={(e) => setSettings({ ...settings, enableTranslation: e.target.checked })}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                </label>
              </div>

              {/* OCR Settings */}
              {settings.enableOcr && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <h3 style={{
                    fontWeight: '500',
                    color: '#111827',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <FileText style={{ width: '1rem', height: '1rem' }} />
                    OCR Settings
                  </h3>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.25rem'
                    }}>
                      Default OCR Language
                    </label>
                    <select
                      value={settings.defaultOcrLanguage}
                      onChange={(e) => setSettings({ ...settings, defaultOcrLanguage: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    >
                      {capabilities?.ocr_languages.map((lang) => (
                        <option key={lang} value={lang}>
                          {OCR_LANGUAGE_NAMES[lang] || lang}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={settings.autoDetectLanguage}
                      onChange={(e) => setSettings({ ...settings, autoDetectLanguage: e.target.checked })}
                      style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.875rem' }}>Auto-detect document language</span>
                  </label>
                </div>
              )}

              {/* Translation Settings */}
              {settings.enableTranslation && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <h3 style={{
                    fontWeight: '500',
                    color: '#111827',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Globe style={{ width: '1rem', height: '1rem' }} />
                    Translation Settings
                  </h3>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.25rem'
                    }}>
                      Default Target Language
                    </label>
                    <select
                      value={settings.defaultTranslateLanguage}
                      onChange={(e) => setSettings({ ...settings, defaultTranslateLanguage: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    >
                      {capabilities?.translation_languages.map((lang) => (
                        <option key={lang} value={lang}>
                          {LANGUAGE_NAMES[lang] || lang}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.25rem'
                    }}>
                      PDF Translation Mode
                    </label>
                    <select
                      value={settings.translatePdfMode}
                      onChange={(e) => setSettings({ ...settings, translatePdfMode: e.target.value as 'overlay' | 'append' })}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="overlay">Overlay (replace text in place)</option>
                      <option value="append">Append (add translated pages)</option>
                    </select>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={settings.preserveNumbers}
                      onChange={(e) => setSettings({ ...settings, preserveNumbers: e.target.checked })}
                      style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.875rem' }}>Preserve numbers during translation</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={settings.preserveFormulas}
                      onChange={(e) => setSettings({ ...settings, preserveFormulas: e.target.checked })}
                      style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.875rem' }}>Preserve Excel formulas</span>
                  </label>
                </div>
              )}

              {/* Supported Formats */}
              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                <h3 style={{ fontWeight: '500', color: '#111827', marginBottom: '0.5rem' }}>Supported Formats</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {capabilities && Object.keys(capabilities.supported_file_types).map((ext) => (
                    <span
                      key={ext}
                      style={{
                        padding: '0.125rem 0.5rem',
                        backgroundColor: '#f3f4f6',
                        color: '#4b5563',
                        fontSize: '0.75rem',
                        borderRadius: '4px'
                      }}
                    >
                      {ext}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              color: '#374151',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={saveSettings}
            disabled={!serviceAvailable}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              backgroundColor: serviceAvailable ? '#2563eb' : '#93c5fd',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: serviceAvailable ? 'pointer' : 'not-allowed',
              opacity: serviceAvailable ? 1 : 0.5
            }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default DocumentProcessingSettings;
