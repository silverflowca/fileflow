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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Document Processing</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2">Loading capabilities...</span>
            </div>
          ) : !serviceAvailable ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-gray-600">PDFFlow service is not available</p>
              <p className="text-sm text-gray-500 mt-1">Document processing features are disabled</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Service Status */}
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded">
                <Check className="w-4 h-4" />
                <span>PDFFlow connected</span>
              </div>

              {/* Feature Toggles */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  Features
                </h3>

                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Text Extraction</span>
                    <p className="text-xs text-gray-500">Extract text from PDFs and documents</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableExtraction}
                    onChange={(e) => setSettings({ ...settings, enableExtraction: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">OCR Processing</span>
                    <p className="text-xs text-gray-500">Recognize text in scanned documents</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableOcr}
                    onChange={(e) => setSettings({ ...settings, enableOcr: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Translation</span>
                    <p className="text-xs text-gray-500">Translate documents to other languages</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableTranslation}
                    onChange={(e) => setSettings({ ...settings, enableTranslation: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </label>
              </div>

              {/* OCR Settings */}
              {settings.enableOcr && (
                <div className="space-y-3 pt-2 border-t">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    OCR Settings
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default OCR Language
                    </label>
                    <select
                      value={settings.defaultOcrLanguage}
                      onChange={(e) => setSettings({ ...settings, defaultOcrLanguage: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      {capabilities?.ocr_languages.map((lang) => (
                        <option key={lang} value={lang}>
                          {OCR_LANGUAGE_NAMES[lang] || lang}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.autoDetectLanguage}
                      onChange={(e) => setSettings({ ...settings, autoDetectLanguage: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">Auto-detect document language</span>
                  </label>
                </div>
              )}

              {/* Translation Settings */}
              {settings.enableTranslation && (
                <div className="space-y-3 pt-2 border-t">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Translation Settings
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Target Language
                    </label>
                    <select
                      value={settings.defaultTranslateLanguage}
                      onChange={(e) => setSettings({ ...settings, defaultTranslateLanguage: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      {capabilities?.translation_languages.map((lang) => (
                        <option key={lang} value={lang}>
                          {LANGUAGE_NAMES[lang] || lang}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PDF Translation Mode
                    </label>
                    <select
                      value={settings.translatePdfMode}
                      onChange={(e) => setSettings({ ...settings, translatePdfMode: e.target.value as 'overlay' | 'append' })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="overlay">Overlay (replace text in place)</option>
                      <option value="append">Append (add translated pages)</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.preserveNumbers}
                      onChange={(e) => setSettings({ ...settings, preserveNumbers: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">Preserve numbers during translation</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.preserveFormulas}
                      onChange={(e) => setSettings({ ...settings, preserveFormulas: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">Preserve Excel formulas</span>
                  </label>
                </div>
              )}

              {/* Supported Formats */}
              <div className="pt-2 border-t">
                <h3 className="font-medium text-gray-900 mb-2">Supported Formats</h3>
                <div className="flex flex-wrap gap-1">
                  {capabilities && Object.keys(capabilities.supported_file_types).map((ext) => (
                    <span
                      key={ext}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
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
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={saveSettings}
            disabled={!serviceAvailable}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default DocumentProcessingSettings;
