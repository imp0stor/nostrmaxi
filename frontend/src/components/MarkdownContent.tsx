import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { hasMarkdown } from '../lib/markdown';

const MAX_MARKDOWN_LENGTH = 20000;

export const MarkdownContent = memo(function MarkdownContent({ text, className = '' }: { text: string; className?: string }) {
  const trimmed = text.trim();
  const isMarkdown = useMemo(() => hasMarkdown(trimmed), [trimmed]);

  if (!trimmed) return null;

  if (!isMarkdown || trimmed.length > MAX_MARKDOWN_LENGTH) {
    return <p className={`text-slate-100 whitespace-pre-wrap leading-relaxed tracking-[0.01em] ${className}`.trim()}>{trimmed}</p>;
  }

  return (
    <div className={`nm-markdown text-slate-100 leading-relaxed space-y-3 break-words ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        urlTransform={(url) => (/^(https?:|mailto:)/i.test(url) ? url : '')}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-semibold text-slate-100 mt-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold text-slate-100 mt-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-slate-100 mt-2">{children}</h3>,
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-gray-100">{children}</li>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-orange-500/60 bg-orange-950/20 px-3 py-2 text-slate-300 italic">{children}</blockquote>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-orange-300 underline underline-offset-2 hover:text-orange-200">{children}</a>,
          code: ({ children }) => <code className="rounded bg-slate-800/90 px-1.5 py-0.5 text-xs text-orange-200">{children}</code>,
          pre: ({ children }) => <pre className="overflow-x-auto rounded-md bg-slate-950/80 p-3 text-xs text-orange-100">{children}</pre>,
          hr: () => <hr className="border-slate-700/80" />,
        }}
      >
        {trimmed}
      </ReactMarkdown>
    </div>
  );
});
