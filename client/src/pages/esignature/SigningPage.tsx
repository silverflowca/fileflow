import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, AlertCircle, Clock, Calendar, User, Mail, Briefcase } from 'lucide-react';
import SignaturePad from '../../components/esignature/SignaturePad';
import api from '../../lib/api';
import { SignatureRequest, Signatory } from '../../types/esignature';

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<SignatureRequest | null>(null);
  const [signatory, setSignatory] = useState<Signatory | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);

  // Fetch signing details
  useEffect(() => {
    const fetchDetails = async () => {
      if (!token) {
        setError('Invalid signing link');
        setLoading(false);
        return;
      }

      try {
        const data = await api.getSigningDetails(token);
        setRequest(data.request);
        setSignatory(data.signatory);
        setName(data.signatory.name);
        setEmail(data.signatory.email);

        if (data.signatory.status === 'signed') {
          setSigned(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load signing details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [token]);

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signatureData) {
      setError('Please provide your signature');
      return;
    }

    if (!agreedToTerms) {
      setError('Please agree to the terms to proceed');
      return;
    }

    if (!signatory || !token) return;

    setSubmitting(true);
    setError(null);

    try {
      await api.signDocument({
        signatory_id: signatory.id,
        access_token: token,
        signature_data: signatureData,
        name,
        email
      });
      setSigned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign document');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p style={{ color: '#6b7280' }}>Loading document...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '400px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
          <h2 style={{ margin: '0 0 0.5rem', color: '#111827' }}>Link Invalid or Expired</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2.5rem',
          textAlign: 'center',
          maxWidth: '500px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#dcfce7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <CheckCircle size={32} style={{ color: '#16a34a' }} />
          </div>
          <h2 style={{ margin: '0 0 0.75rem', color: '#111827', fontSize: '1.5rem' }}>
            Document Signed Successfully!
          </h2>
          <p style={{ color: '#6b7280', margin: '0 0 1.5rem', lineHeight: '1.6' }}>
            Thank you for signing "{request?.title}". All parties will be notified
            and you will receive a copy of the fully signed document once all
            signatories have completed signing.
          </p>
          <div style={{
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            fontSize: '0.875rem'
          }}>
            <p style={{ margin: '0 0 0.25rem', color: '#374151', fontWeight: '500' }}>
              Signed by: {name}
            </p>
            <p style={{ margin: 0, color: '#6b7280' }}>
              {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 2rem'
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={20} style={{ color: 'white' }} />
            </div>
            <span style={{ fontWeight: '600', fontSize: '1.125rem' }}>FileFlow</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            <Clock size={16} />
            Document Signing
          </div>
        </div>
      </header>

      <main style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '2rem 1rem'
      }}>
        {/* Document Info Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginBottom: '1.5rem',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: '600' }}>
              {request?.title}
            </h1>
            {request?.description && (
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                {request.description}
              </p>
            )}
          </div>

          <div style={{
            padding: '1rem 1.5rem',
            backgroundColor: '#f9fafb',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
            fontSize: '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={16} style={{ color: '#6b7280' }} />
              <span style={{ color: '#6b7280' }}>Created:</span>
              <span style={{ fontWeight: '500' }}>
                {new Date(request?.created_at || '').toLocaleDateString()}
              </span>
            </div>
            {signatory?.title && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={16} style={{ color: '#6b7280' }} />
                <span style={{ color: '#6b7280' }}>Role:</span>
                <span style={{ fontWeight: '500' }}>{signatory.title}</span>
              </div>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* Signing Form */}
        <form onSubmit={handleSign}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1rem', fontWeight: '600' }}>
              Your Information
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: '#374151'
                }}>
                  <User size={16} />
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: '#374151'
                }}>
                  <Mail size={16} />
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Signature Section */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '600' }}>
              Your Signature
            </h2>
            <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
              Draw your signature in the box below using your mouse or finger
            </p>

            <SignaturePad
              onSignatureChange={setSignatureData}
              width={600}
              height={200}
            />
          </div>

          {/* Agreement & Submit */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            padding: '1.5rem'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              cursor: 'pointer',
              marginBottom: '1.5rem'
            }}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  marginTop: '2px',
                  accentColor: '#3b82f6'
                }}
              />
              <span style={{ fontSize: '0.875rem', color: '#374151', lineHeight: '1.5' }}>
                I agree that my electronic signature is the legal equivalent of my manual
                signature. By checking this box and signing, I confirm that I have read
                and understand the document and consent to sign it electronically.
              </span>
            </label>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
                Date: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
              </p>
              <button
                type="submit"
                disabled={submitting || !signatureData || !agreedToTerms}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 2rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'white',
                  backgroundColor: (submitting || !signatureData || !agreedToTerms) ? '#93c5fd' : '#3b82f6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (submitting || !signatureData || !agreedToTerms) ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <CheckCircle size={20} />
                {submitting ? 'Signing...' : 'Sign Document'}
              </button>
            </div>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: '0.75rem'
      }}>
        <p style={{ margin: 0 }}>
          Secured by FileFlow E-Signature. All signatures are legally binding.
        </p>
      </footer>
    </div>
  );
}
