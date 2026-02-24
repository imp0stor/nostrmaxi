import { useState } from 'react';
import { nip19 } from 'nostr-tools';

interface VerificationResult {
  valid: boolean;
  pubkey?: string;
  names?: { [name: string]: string };
  relays?: { [pubkey: string]: string[] };
  error?: string;
}

export function IdentityChecker() {
  const [input, setInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const checkIdentity = async () => {
    if (!input.trim()) return;
    
    setIsChecking(true);
    setResult(null);

    try {
      // Check if it's an npub
      if (input.startsWith('npub1')) {
        const decoded = nip19.decode(input);
        if (decoded.type === 'npub') {
          const pubkey = decoded.data as string;
          // We don't have a direct npub->nip05 reverse lookup endpoint
          // So we'll just show the pubkey
          setResult({
            valid: true,
            pubkey,
            error: 'To check if this npub has a NIP-05 identity, search by name@domain instead.',
          });
        }
      } 
      // Check if it's a name@domain format
      else if (input.includes('@')) {
        const [localPart, domain] = input.split('@');
        
        // Check via the NIP-05 well-known endpoint
        try {
          const response = await fetch(
            `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(localPart)}`
          );
          
          if (response.ok) {
            const data = await response.json();
            setResult({
              valid: true,
              pubkey: data.names?.[localPart],
              names: data.names,
              relays: data.relays,
            });
          } else {
            setResult({
              valid: false,
              error: `No NIP-05 identity found for ${input}`,
            });
          }
        } catch (err) {
          setResult({
            valid: false,
            error: `Could not verify ${input}. Domain may not support NIP-05.`,
          });
        }
      } else {
        setResult({
          valid: false,
          error: 'Please enter a valid npub or name@domain format',
        });
      }
    } catch (err) {
      setResult({
        valid: false,
        error: err instanceof Error ? err.message : 'Invalid input',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      checkIdentity();
    }
  };

  const truncatePubkey = (pubkey: string) => {
    if (pubkey.length < 16) return pubkey;
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-nostr-dark border border-gray-700 rounded-xl p-6 shadow-lg">
        <h3 className="text-2xl font-bold text-white mb-4 text-center">
          Check NIP-05 Identity
        </h3>
        <p className="text-gray-400 text-center mb-6">
          Verify any Nostr identity by npub or name@domain
        </p>

        {/* Input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="alice@nostrmaxi.com or npub1..."
            className="flex-1 px-4 py-3 bg-nostr-darker border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-nostr-purple focus:ring-1 focus:ring-nostr-purple outline-none"
          />
          <button
            onClick={checkIdentity}
            disabled={isChecking || !input.trim()}
            className="px-6 py-3 bg-nostr-purple hover:bg-nostr-purple/80 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all"
          >
            {isChecking ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Check'
            )}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div
            className={`p-4 rounded-lg border ${
              result.valid && !result.error
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            {result.valid && !result.error ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg
                    className="w-6 h-6 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-green-400 font-semibold text-lg">
                    Verified Identity
                  </span>
                </div>

                {result.pubkey && (
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-400 text-sm">Public Key:</span>
                      <div className="font-mono text-white text-sm bg-nostr-darker p-2 rounded mt-1 break-all">
                        {truncatePubkey(result.pubkey)}
                      </div>
                    </div>

                    {result.names && Object.keys(result.names).length > 0 && (
                      <div>
                        <span className="text-gray-400 text-sm">Identities:</span>
                        <div className="mt-1 space-y-1">
                          {Object.entries(result.names).map(([name, pubkey]) => (
                            <div
                              key={name}
                              className="text-sm bg-nostr-darker p-2 rounded"
                            >
                              <span className="text-nostr-purple font-semibold">
                                {name}
                              </span>
                              <span className="text-gray-500 mx-2">→</span>
                              <span className="text-gray-300 font-mono text-xs">
                                {truncatePubkey(pubkey)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.relays && Object.keys(result.relays).length > 0 && (
                      <div>
                        <span className="text-gray-400 text-sm">Recommended Relays:</span>
                        <div className="mt-1 space-y-1">
                          {Object.values(result.relays)[0]?.slice(0, 3).map((relay) => (
                            <div
                              key={relay}
                              className="text-xs text-gray-400 bg-nostr-darker p-2 rounded font-mono"
                            >
                              {relay}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-6 h-6 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-red-400 font-semibold">
                    {result.valid ? 'Note' : 'Not Found'}
                  </span>
                </div>
                <p className="text-gray-300 text-sm">{result.error}</p>
              </div>
            )}
          </div>
        )}

        {/* Example hint */}
        {!result && (
          <div className="mt-4 text-center">
            <p className="text-gray-500 text-sm">
              Try:{' '}
              <button
                onClick={() => setInput('alice@nostrmaxi.com')}
                className="text-nostr-purple hover:text-nostr-orange underline"
              >
                alice@nostrmaxi.com
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
