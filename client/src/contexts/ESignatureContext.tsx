import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import api from '../lib/api';
import {
  SignatureRequest,
  Signatory,
  CreateSignatureRequestInput,
  SignDocumentInput
} from '../types/esignature';

interface ESignatureContextType {
  requests: SignatureRequest[];
  loading: boolean;
  error: string | null;
  fetchRequests: () => Promise<void>;
  createRequest: (input: CreateSignatureRequestInput) => Promise<SignatureRequest>;
  getRequest: (id: string) => Promise<SignatureRequest>;
  sendRequest: (id: string) => Promise<void>;
  cancelRequest: (id: string) => Promise<void>;
  deleteRequest: (id: string) => Promise<void>;
  getSigningDetails: (token: string) => Promise<{ request: SignatureRequest; signatory: Signatory }>;
  signDocument: (input: SignDocumentInput) => Promise<void>;
}

const ESignatureContext = createContext<ESignatureContextType | undefined>(undefined);

export function ESignatureProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSignatureRequests();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load signature requests');
    } finally {
      setLoading(false);
    }
  }, []);

  const createRequest = useCallback(async (input: CreateSignatureRequestInput): Promise<SignatureRequest> => {
    const data = await api.createSignatureRequest(input);
    await fetchRequests();
    return data;
  }, [fetchRequests]);

  const getRequest = useCallback(async (id: string): Promise<SignatureRequest> => {
    return api.getSignatureRequest(id);
  }, []);

  const sendRequest = useCallback(async (id: string): Promise<void> => {
    await api.sendSignatureRequest(id);
    await fetchRequests();
  }, [fetchRequests]);

  const cancelRequest = useCallback(async (id: string): Promise<void> => {
    await api.cancelSignatureRequest(id);
    await fetchRequests();
  }, [fetchRequests]);

  const deleteRequest = useCallback(async (id: string): Promise<void> => {
    await api.deleteSignatureRequest(id);
    await fetchRequests();
  }, [fetchRequests]);

  const getSigningDetails = useCallback(async (token: string) => {
    return api.getSigningDetails(token);
  }, []);

  const signDocument = useCallback(async (input: SignDocumentInput): Promise<void> => {
    await api.signDocument(input);
  }, []);

  return (
    <ESignatureContext.Provider value={{
      requests,
      loading,
      error,
      fetchRequests,
      createRequest,
      getRequest,
      sendRequest,
      cancelRequest,
      deleteRequest,
      getSigningDetails,
      signDocument,
    }}>
      {children}
    </ESignatureContext.Provider>
  );
}

export function useESignature() {
  const context = useContext(ESignatureContext);
  if (context === undefined) {
    throw new Error('useESignature must be used within an ESignatureProvider');
  }
  return context;
}
