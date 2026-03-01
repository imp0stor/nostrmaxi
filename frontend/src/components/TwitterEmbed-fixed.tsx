import React from 'react';

interface TwitterEmbedProps {
  url: string;
  metadata?: {
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
  };
}

export const TwitterEmbed: React.FC<TwitterEmbedProps> = ({ url, metadata }) => {
  if (!metadata) {
    return (
      <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-400 hover:underline break-all"
        >
          {url}
        </a>
      </div>
    );
  }

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/50 max-w-2xl">
      {metadata.image && (
        <div className="w-full">
          <img
            src={metadata.image}
            alt={metadata.title || 'Tweet image'}
            className="w-full h-auto object-contain"
            loading="lazy"
          />
        </div>
      )}
      {(metadata.title || metadata.description) && (
        <div className="p-4">
          {metadata.title && (
            <h3 className="font-semibold text-white mb-2">{metadata.title}</h3>
          )}
          {metadata.description && (
            <p className="text-gray-300 text-sm mb-3">{metadata.description}</p>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:underline text-sm flex items-center gap-2"
          >
            <span>View on {metadata.siteName || 'X'}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
};
