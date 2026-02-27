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
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(uri);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      // Fall through to fallback
    }
    
    // Fallback: create temporary textarea and use execCommand
    try {
      const textarea = document.createElement('textarea');
      textarea.value = uri;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Show the URI field if copy completely fails
      alert('Copy failed. Please manually select and copy the URI shown below.');
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
        className="w-full rounded-lg border border-cyan-500/50 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20 py-3 font-medium"
      >
        {copied ? '✓ Copied!' : '📋 Copy Connection URI'}
      </button>

      {/* Visible URI for manual copy */}
      <div className="space-y-1">
        <label className="text-xs text-gray-400">Connection URI (tap to select):</label>
        <input
          type="text"
          readOnly
          value={uri}
          onFocus={(e) => e.target.select()}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-300 font-mono"
        />
      </div>

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
