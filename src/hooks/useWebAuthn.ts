import { useState, useCallback } from 'react';

interface WebAuthnCredential {
  id: string;
  publicKey: ArrayBuffer;
}

const CRED_KEY = 'dl_cred_id';

const toBase64Url = (buf: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (base64: string): Uint8Array => {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
};

export const useWebAuthn = () => {
  const [isSupported] = useState(() => 
    typeof window !== 'undefined' && 
    'credentials' in navigator && 
    'create' in navigator.credentials
  );

  const getStoredCredentialId = () => (typeof window !== 'undefined' ? localStorage.getItem(CRED_KEY) : null);

  const registerCredential = useCallback(async (): Promise<WebAuthnCredential | null> => {
    if (!isSupported) {
      throw new Error('WebAuthn not supported');
    }

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'DigiLocker',
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode('user'),
            name: 'user@digilocker.com',
            displayName: 'DigiLocker User',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            residentKey: 'required',
            userVerification: 'required',
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      const response = credential.response as AuthenticatorAttestationResponse;
      
      const id64 = toBase64Url(credential.rawId);
      const result = {
        id: id64,
        publicKey: response.getPublicKey() || new ArrayBuffer(0),
      } as WebAuthnCredential;
      // persist id
      localStorage.setItem(CRED_KEY, id64);
      return result;
    } catch (error) {
      console.error('WebAuthn registration failed:', error);
      throw error;
    }
  }, [isSupported]);

  const authenticateUser = useCallback(async (credentialId?: string): Promise<boolean> => {
    credentialId = credentialId || getStoredCredentialId() || undefined;
    if (!isSupported) {
      throw new Error('WebAuthn not supported');
    }

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const allowCredentials = credentialId ? [{
        id: fromBase64Url(credentialId),
        type: 'public-key' as const,
        transports: ['internal'] as AuthenticatorTransport[],
      }] : [];

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials,
          userVerification: 'required',
          timeout: 60000,
        },
        mediation: 'optional' as CredentialMediationRequirement,
      } as CredentialRequestOptions);

      return !!assertion;
    } catch (error) {
      console.error('WebAuthn authentication failed:', error);
      return false;
    }
  }, [isSupported]);

  return {
    isSupported,
    registerCredential,
    authenticateUser,
  };
};
