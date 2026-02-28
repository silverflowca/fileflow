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
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Document Actions
      </h3>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <X className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {/* Extract Text */}
        {settings.enableExtraction && (
          <button
            onClick={handleExtract}
            disabled={extractStatus === 'loading'}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            {extractStatus === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : extractStatus === 'success' ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Extract Text
          </button>
        )}

        {/* OCR */}
        {settings.enableOcr && (
          <button
            onClick={handleOcr}
            disabled={ocrStatus === 'loading'}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            {ocrStatus === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : ocrStatus === 'success' ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Scan className="w-4 h-4" />
            )}
            Run OCR
          </button>
        )}

        {/* Detect Language */}
        <button
          onClick={handleDetectLanguage}
          disabled={detectStatus === 'loading'}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
        >
          {detectStatus === 'loading' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : detectStatus === 'success' ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Globe className="w-4 h-4" />
          )}
          Detect Language
        </button>

        {/* Translate */}
        {settings.enableTranslation && (
          <div className="relative">
            <button
              onClick={() => setShowTranslateOptions(!showTranslateOptions)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Languages className="w-4 h-4" />
              Translate
              <ChevronDown className="w-3 h-3" />
            </button>

            {showTranslateOptions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 p-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Target Language
                </label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded text-sm mb-2"
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
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
                >
                  {translateStatus === 'loading' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
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
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm">
            <span className="font-medium">Detected Language:</span>{' '}
            {LANGUAGES.find(l => l.code === detectedLanguage.code)?.name || detectedLanguage.code}
            <span className="text-gray-500 ml-1">
              ({Math.round(detectedLanguage.confidence * 100)}% confidence)
            </span>
          </p>
        </div>
      )}

      {extractedText && (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
            <span className="text-sm font-medium">Extracted Text</span>
            <button
              onClick={() => copyToClipboard(extractedText)}
              className="p-1 hover:bg-gray-200 rounded"
              title="Copy to clipboard"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 max-h-48 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
              {extractedText.slice(0, 2000)}
              {extractedText.length > 2000 && '...'}
            </pre>
          </div>
        </div>
      )}

      {translatedText && (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-green-50 border-b">
            <span className="text-sm font-medium">Translated Text</span>
            <button
              onClick={() => copyToClipboard(translatedText)}
              className="p-1 hover:bg-green-100 rounded"
              title="Copy to clipboard"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 max-h-48 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
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
          className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
        >
          <Download className="w-4 h-4" />
          Download Translated PDF
        </a>
      )}
    </div>
  );
}

export default DocumentActionsPanel;
