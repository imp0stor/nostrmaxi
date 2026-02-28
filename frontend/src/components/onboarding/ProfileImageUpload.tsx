import { useRef, useState } from 'react';

interface Props {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSkip: () => void;
  previewFallback?: string;
}

export function ProfileImageUpload({ label, value, placeholder, onChange, onSkip, previewFallback = '👤' }: Props) {
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onFileChange = async (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-slate-950/50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-cyan-100">{label}</p>
        <button type="button" className="text-xs text-cyan-300 underline" onClick={onSkip}>Skip for now</button>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-16 w-16 rounded-lg overflow-hidden border border-cyan-500/20 bg-slate-900 flex items-center justify-center text-xl">
          {value ? <img src={value} alt={`${label} preview`} className="h-full w-full object-cover" /> : previewFallback}
        </div>
        <div className="flex-1 space-y-2">
          <input
            className="cy-input"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={placeholder || 'https://...'}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="cy-btn-secondary text-xs" onClick={() => onChange(urlInput.trim())}>Use URL</button>
            <button type="button" className="cy-btn-secondary text-xs" onClick={() => fileInputRef.current?.click()}>Upload</button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFileChange(e.target.files?.[0])}
          />
        </div>
      </div>
    </div>
  );
}
