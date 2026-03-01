import { useMemo } from 'react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  preview: boolean;
}

function lightweightPreview(markdown: string): string {
  return markdown
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

export function MarkdownEditor({ value, onChange, preview }: MarkdownEditorProps) {
  const rendered = useMemo(() => lightweightPreview(value || ''), [value]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[360px] w-full rounded border border-orange-500/30 bg-black text-orange-100 p-3 font-mono text-sm"
        placeholder="# Chapter title\n\nWrite markdown here..."
      />
      <div className="min-h-[360px] rounded border border-orange-500/30 bg-black p-3 text-orange-100 overflow-auto">
        {preview ? (
          <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: rendered }} />
        ) : (
          <pre className="whitespace-pre-wrap text-sm">{value}</pre>
        )}
      </div>
    </div>
  );
}
