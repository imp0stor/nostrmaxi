import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface LnurlQrCodeProps {
  lnurl: string;
  size?: number;
}

export function LnurlQrCode({ lnurl, size = 256 }: LnurlQrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current && lnurl) {
      QRCode.toCanvas(canvasRef.current, lnurl.toUpperCase(), {
        width: size,
        margin: 2,
        color: {
          dark: '#1a1a2e',
          light: '#ffffff',
        },
      });
    }
  }, [lnurl, size]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(lnurl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = lnurl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* QR Code */}
      <div className="rounded-xl border border-gray-700 bg-nostr-darker p-3 shadow-lg shadow-black/30">
        <div className="bg-white p-3 rounded-lg">
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="mt-4 flex items-center gap-2 px-4 py-2 bg-nostr-purple/20 hover:bg-nostr-purple/30 text-nostr-purple rounded-lg transition-colors"
      >
        {copied ? (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy LNURL
          </>
        )}
      </button>

      {/* LNURL display */}
      <div className="mt-3 text-xs text-gray-500 break-all max-w-[280px] text-center font-mono">
        {lnurl.slice(0, 30)}...
      </div>
    </div>
  );
}
