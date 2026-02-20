import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Receipt } from '../types';

export function ReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;

    api.getReceipt(paymentId)
      .then(setReceipt)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [paymentId]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-nostr-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Receipt Not Found</h1>
        <p className="text-gray-400 mb-6">{error || 'Unable to load receipt'}</p>
        <Link
          to="/dashboard"
          className="text-nostr-purple hover:underline"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-white { background: white !important; color: black !important; }
        }
      `}</style>

      {/* Actions */}
      <div className="flex justify-between items-center mb-6 no-print">
        <Link
          to="/dashboard"
          className="text-gray-400 hover:text-white flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </button>
      </div>

      {/* Receipt */}
      <div className="bg-nostr-dark print-white rounded-xl p-8 border border-gray-800">
        {/* Header */}
        <div className="text-center mb-8 pb-8 border-b border-gray-700">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl">⚡</span>
            <span className="text-2xl font-bold text-gradient print:text-black">NostrMaxi</span>
          </div>
          <p className="text-gray-400 print:text-gray-600">Payment Receipt</p>
        </div>

        {/* Receipt details */}
        <div className="space-y-6">
          {/* Receipt number */}
          <div className="flex justify-between items-center">
            <span className="text-gray-400 print:text-gray-600">Receipt Number</span>
            <span className="text-white print:text-black font-mono font-bold">{receipt.receiptNumber}</span>
          </div>

          {/* Date */}
          <div className="flex justify-between items-center">
            <span className="text-gray-400 print:text-gray-600">Date</span>
            <span className="text-white print:text-black">
              {new Date(receipt.date).toLocaleString()}
            </span>
          </div>

          {/* Divider */}
          <hr className="border-gray-700" />

          {/* Item */}
          <div>
            <h3 className="text-lg font-bold text-white print:text-black mb-2">{receipt.item}</h3>
            <p className="text-gray-400 print:text-gray-600 text-sm">{receipt.description}</p>
          </div>

          {/* Amount */}
          <div className="bg-nostr-darker print:bg-gray-100 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 print:text-gray-600">Amount (sats)</span>
              <span className="text-2xl font-bold text-nostr-orange print:text-orange-600">
                {receipt.amountSats?.toLocaleString()} sats
              </span>
            </div>
            {receipt.amountUsd && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Amount (USD)</span>
                <span className="text-gray-400 print:text-gray-600">
                  ${(receipt.amountUsd / 100).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div className="flex justify-between items-center">
            <span className="text-gray-400 print:text-gray-600">Payment Method</span>
            <span className="text-white print:text-black flex items-center gap-2">
              <svg className="w-5 h-5 text-nostr-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {receipt.paymentMethod}
            </span>
          </div>

          {/* Payment hash */}
          {receipt.paymentHash && (
            <div>
              <span className="text-gray-400 print:text-gray-600 text-sm">Payment Hash</span>
              <p className="text-gray-500 font-mono text-xs break-all mt-1">
                {receipt.paymentHash}
              </p>
            </div>
          )}

          {/* Divider */}
          <hr className="border-gray-700" />

          {/* Customer */}
          <div>
            <span className="text-gray-400 print:text-gray-600 text-sm">Paid by</span>
            <p className="text-white print:text-black font-mono text-sm mt-1">
              {receipt.customer.npub}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-8 border-t border-gray-700 text-center">
          <p className="text-gray-500 text-sm">
            Thank you for supporting NostrMaxi!
          </p>
          <p className="text-gray-600 text-xs mt-2">
            Questions? Contact us on Nostr
          </p>
        </div>
      </div>
    </div>
  );
}
