import { useRef, useEffect, useState, useCallback } from 'react';
import { Trash2, PenTool, Type } from 'lucide-react';

// Signature font styles using CSS font-family with fallbacks
const SIGNATURE_FONTS = [
  { name: 'Brush Script', value: '"Brush Script MT", "Segoe Script", cursive' },
  { name: 'Lucida', value: '"Lucida Handwriting", "Comic Sans MS", cursive' },
  { name: 'Script', value: '"Script MT Bold", "Bradley Hand", cursive' },
  { name: 'Edwardian', value: '"Edwardian Script ITC", "Snell Roundhand", cursive' },
  { name: 'Freestyle', value: '"Freestyle Script", "Zapfino", cursive' },
];

interface SignaturePadProps {
  onSignatureChange: (signatureData: string | null) => void;
  width?: number;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
}

type SignatureMode = 'draw' | 'type';

export default function SignaturePad({
  onSignatureChange,
  width = 400,
  height = 200,
  penColor = '#000000',
  backgroundColor = '#ffffff'
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // New state for signature mode
  const [mode, setMode] = useState<SignatureMode>('draw');
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0].value);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [backgroundColor, penColor]);

  // Render typed signature on canvas
  const renderTypedSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !typedName.trim()) return;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw signature line
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();

    // Calculate font size to fit the canvas
    let fontSize = 48;
    ctx.font = `${fontSize}px ${selectedFont}`;
    let textWidth = ctx.measureText(typedName).width;

    // Reduce font size if text is too wide
    while (textWidth > canvas.width - 60 && fontSize > 20) {
      fontSize -= 2;
      ctx.font = `${fontSize}px ${selectedFont}`;
      textWidth = ctx.measureText(typedName).width;
    }

    // Draw the signature text
    ctx.fillStyle = penColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(typedName, canvas.width / 2, canvas.height - 40);

    // Get the signature data
    const signatureData = canvas.toDataURL('image/png');
    onSignatureChange(signatureData);
    setHasSignature(true);
  }, [typedName, selectedFont, penColor, backgroundColor, onSignatureChange]);

  // Update typed signature when name or font changes
  useEffect(() => {
    if (mode === 'type' && typedName.trim()) {
      renderTypedSignature();
    } else if (mode === 'type' && !typedName.trim()) {
      clearSignature();
    }
  }, [typedName, selectedFont, mode, renderTypedSignature]);

  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'draw') return;
    e.preventDefault();
    setIsDrawing(true);
    const point = getCoordinates(e);
    lastPoint.current = point;
  }, [getCoordinates, mode]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || mode !== 'draw') return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastPoint.current) return;

    const currentPoint = getCoordinates(e);

    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    lastPoint.current = currentPoint;
    setHasSignature(true);
  }, [isDrawing, getCoordinates, penColor, mode]);

  const stopDrawing = useCallback(() => {
    if (isDrawing && hasSignature && mode === 'draw') {
      const canvas = canvasRef.current;
      if (canvas) {
        const signatureData = canvas.toDataURL('image/png');
        onSignatureChange(signatureData);
      }
    }
    setIsDrawing(false);
    lastPoint.current = null;
  }, [isDrawing, hasSignature, onSignatureChange, mode]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange(null);
    if (mode === 'type') {
      setTypedName('');
    }
  }, [backgroundColor, onSignatureChange, mode]);

  const switchMode = (newMode: SignatureMode) => {
    if (newMode !== mode) {
      clearSignature();
      setMode(newMode);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => switchMode('draw')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            fontSize: '0.875rem',
            fontWeight: mode === 'draw' ? '600' : '400',
            color: mode === 'draw' ? '#ffffff' : '#374151',
            backgroundColor: mode === 'draw' ? '#3b82f6' : '#f3f4f6',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <PenTool size={16} />
          Draw
        </button>
        <button
          type="button"
          onClick={() => switchMode('type')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            fontSize: '0.875rem',
            fontWeight: mode === 'type' ? '600' : '400',
            color: mode === 'type' ? '#ffffff' : '#374151',
            backgroundColor: mode === 'type' ? '#3b82f6' : '#f3f4f6',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Type size={16} />
          Type
        </button>
      </div>

      {/* Type Mode Input */}
      {mode === 'type' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type your full name"
            style={{
              padding: '0.75rem 1rem',
              fontSize: '1rem',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              outline: 'none',
              transition: 'border-color 0.15s ease'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {SIGNATURE_FONTS.map((font) => (
              <button
                key={font.name}
                type="button"
                onClick={() => setSelectedFont(font.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  fontFamily: font.value,
                  color: selectedFont === font.value ? '#ffffff' : '#374151',
                  backgroundColor: selectedFont === font.value ? '#3b82f6' : '#f9fafb',
                  border: selectedFont === font.value ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  minWidth: '80px'
                }}
              >
                {font.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div style={{
        position: 'relative',
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        touchAction: 'none'
      }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: `${width}px`,
            height: 'auto',
            aspectRatio: `${width}/${height}`,
            cursor: mode === 'draw' ? 'crosshair' : 'default',
            backgroundColor
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {/* Signature line (only show in draw mode when empty) */}
        {mode === 'draw' && (
          <>
            <div style={{
              position: 'absolute',
              bottom: '30px',
              left: '20px',
              right: '20px',
              borderBottom: '1px solid #d1d5db',
              pointerEvents: 'none'
            }} />

            {/* X mark for signature */}
            <span style={{
              position: 'absolute',
              bottom: '32px',
              left: '20px',
              color: '#9ca3af',
              fontSize: '0.875rem',
              pointerEvents: 'none'
            }}>
              X
            </span>
          </>
        )}

        {!hasSignature && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#9ca3af',
            fontSize: '0.875rem',
            pointerEvents: 'none',
            textAlign: 'center'
          }}>
            {mode === 'draw' ? 'Sign here' : 'Type your name above'}
          </div>
        )}
      </div>

      {/* Preview of typed signature */}
      {mode === 'type' && typedName.trim() && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.5rem' }}>
            Preview
          </span>
          <span style={{
            fontFamily: selectedFont,
            fontSize: '2rem',
            color: penColor
          }}>
            {typedName}
          </span>
        </div>
      )}

      {/* Clear Button */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={clearSignature}
          disabled={!hasSignature && !typedName}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.5rem 0.75rem',
            fontSize: '0.75rem',
            color: (hasSignature || typedName) ? '#ef4444' : '#9ca3af',
            backgroundColor: 'transparent',
            border: '1px solid',
            borderColor: (hasSignature || typedName) ? '#fecaca' : '#e5e7eb',
            borderRadius: '6px',
            cursor: (hasSignature || typedName) ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease'
          }}
        >
          <Trash2 size={14} />
          Clear
        </button>
      </div>
    </div>
  );
}
