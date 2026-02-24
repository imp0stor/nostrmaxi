import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface InvoiceQrCodeProps {
  invoice: string;
  size?: number;
}

export function InvoiceQrCode({ invoice, size = 256 }: InvoiceQrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current && invoice) {
      QRCode.toCanvas(canvasRef.current, invoice.toUpperCase(), {
        width: size,
        margin: 2,
        color: {
          dark: '#1a1a2e',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'L',
      });
    }
  }, [invoice, size]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = invoice;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenWallet = () => {
    // Try to open Lightning wallet
    window.location.href = `lightning:${invoice}`;
  };

  return (
    <div className="flex flex-col items-center">
      {/* QR Code */}
      <div className="bg-white p-4 rounded-xl">
        <canvas ref={canvasRef} />
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>

        <button
          onClick={handleOpenWallet}
          className="flex items-center gap-2 px-4 py-2 bg-nostr-orange hover:bg-nostr-orange/80 text-white rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Open Wallet
        </button>
      </div>

      {/* Invoice preview */}
      <div className="mt-3 text-xs text-gray-500 break-all max-w-[280px] text-center font-mono">
        {invoice.slice(0, 40)}...
      </div>
    </div>
  );
}
