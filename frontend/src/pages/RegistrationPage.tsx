import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { usePageMeta } from '../hooks/usePageMeta';

export function RegistrationPage() {
  const { loginWithExtension, loginWithNsec, isLoading, error, user } = useAuth();

  usePageMeta({
    title: 'Register',
    description: 'Create your NostrMaxi account and connect your signer to claim and manage a verified NIP-05 identity.',
    path: '/register',
  });
  const [nsec, setNsec] = useState('');
  const [stepError, setStepError] = useState('');
  const navigate = useNavigate();

  const completeRegistration = async (authMethod: 'nip07' | 'nsec') => {
    try {
      await api.registerOnboardingBootstrap({
        authMethod,
        profile: {
          displayName: user?.npub,
        },
      });
      navigate('/onboarding');
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Could not bootstrap registration');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="cy-card p-6 space-y-4">
        <p className="cy-kicker">REGISTRATION</p>
        <h1 className="cy-title">Create your NostrMaxi account</h1>
        <p className="text-swordfish-muted">Use your signer (NIP-07) or import an nsec key to get started.</p>

        {error ? <div className="cy-card p-3 border-red-500/40 text-red-300 text-sm">{error}</div> : null}
        {stepError ? <div className="cy-card p-3 border-red-500/40 text-red-300 text-sm">{stepError}</div> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="cy-button"
            disabled={isLoading}
            onClick={async () => {
              const ok = await loginWithExtension('alby');
              if (ok) await completeRegistration('nip07');
            }}
          >
            {isLoading ? 'Connecting…' : 'Register with NIP-07'}
          </button>
        </div>

        <div className="space-y-2 pt-2">
          <label className="text-sm text-swordfish-muted">Or paste nsec/private key</label>
          <textarea
            value={nsec}
            onChange={(e) => setNsec(e.target.value)}
            rows={3}
            className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-gray-100"
            placeholder="nsec1..."
          />
          <button
            type="button"
            className="cy-button-ghost"
            disabled={isLoading || !nsec.trim()}
            onClick={async () => {
              const ok = await loginWithNsec(nsec);
              if (ok) await completeRegistration('nsec');
            }}
          >
            Continue with nsec
          </button>
        </div>
      </div>
    </div>
  );
}
