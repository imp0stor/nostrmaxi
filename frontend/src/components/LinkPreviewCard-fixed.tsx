import React from 'react';

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

interface LinkPreviewCardProps {
  preview: LinkPreview;
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({ preview }) => {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-gray-700 rounded-lg overflow-hidden bg-gray-800/50 hover:border-gray-600 transition-colors max-w-2xl"
    >
      {preview.image && (
        <img
          src={preview.image}
          alt={preview.title || 'Preview'}
          className="w-full h-auto object-contain"
          loading="lazy"
        />
      )}
      <div className="p-4">
        {preview.siteName && (
          <div className="text-xs text-gray-500 mb-1">{preview.siteName}</div>
        )}
        {preview.title && (
          <h3 className="font-semibold text-white mb-2 line-clamp-2">{preview.title}</h3>
        )}
        {preview.description && (
          <p className="text-gray-400 text-sm line-clamp-3">{preview.description}</p>
        )}
        <div className="text-orange-400 text-sm mt-2 break-all">{preview.url}</div>
      </div>
    </a>
  );
};
