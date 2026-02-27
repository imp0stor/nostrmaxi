import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { NostrConnectStatus } from '../../hooks/useNostrConnect';

interface QRCodeConnectProps {
  uri: string;
  status: NostrConnectStatus;
  error?: string | null;
  onBack: () => void;
}

export function QRCodeConnect({ uri, status, error, onBack }: QRCodeConnectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !uri) return;

    QRCode.toCanvas(canvasRef.current, uri, {
      width: 240,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
    });
  }, [uri]);

  const copyUri = async () => {
    try {
      await navigator.clipboard.writeText(uri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op fallback
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-300">
        Scan with Amber/Alby signer app or open directly on this device.
      </div>

      <div className="rounded-xl border border-gray-700 bg-nostr-darker p-3 flex justify-center">
        <div className="bg-white p-2 rounded-lg">
          <canvas ref={canvasRef} />
        </div>
      </div>

      <a
        href={uri}
        className="block w-full text-center rounded-lg border border-nostr-purple bg-nostr-purple/20 hover:bg-nostr-purple/30 text-white py-2"
      >
        Open in signer app
      </a>

      <button
        onClick={copyUri}
        className="w-full rounded-lg border border-gray-600 text-gray-200 hover:bg-gray-800 py-2"
      >
        {copied ? 'Copied URI' : 'Copy connection URI'}
      </button>

      <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-3 text-sm text-gray-300">
        Status:{' '}
        <span className="font-medium text-white">
          {status === 'waiting' && 'Waiting for signer approval...'}
          {status === 'connected' && 'Signer connected'}
          {status === 'signing' && 'Signing login challenge...'}
          {status === 'done' && 'Authenticated'}
          {status === 'error' && 'Failed to connect'}
          {status === 'idle' && 'Idle'}
        </span>
      </div>

      {error && <div className="text-sm text-red-300 border border-red-500/40 bg-red-500/10 rounded-lg p-3">{error}</div>}

      <button onClick={onBack} className="text-nostr-purple hover:underline text-sm">
        ← Back to login options
      </button>
    </div>
  );
}
