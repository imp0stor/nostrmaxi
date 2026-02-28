import React from 'react';

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  domain?: string;
}

interface LinkPreviewCardProps {
  preview: LinkPreview;
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({ preview }) => {
  const domain = preview.domain || new URL(preview.url).hostname.replace('www.', '');

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-gray-700 rounded-lg overflow-hidden bg-gray-800/50 hover:border-cyan-500/50 transition-colors"
    >
      {preview.image && (
        <div className="relative h-40 bg-gray-900">
          <img
            src={preview.image}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <img
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
            alt=""
            className="w-4 h-4"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span>{preview.siteName || domain}</span>
        </div>

        <h3 className="font-semibold text-white mb-1 line-clamp-2">{preview.title || 'Link Preview'}</h3>

        {preview.description && (
          <p className="text-gray-400 text-sm line-clamp-2 mb-2">{preview.description}</p>
        )}

        <div className="text-xs text-cyan-400/70 truncate">{preview.url}</div>
      </div>
    </a>
  );
};
