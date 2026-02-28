import { useRef, useState } from 'react';
import { uploadMediaWithFallback, type BlossomUploadResult, type SignEventFn } from '../lib/blossom';

interface MediaUploaderProps {
  label?: string;
  accept?: string;
  signEvent?: SignEventFn;
  onUploaded: (result: BlossomUploadResult) => void;
  className?: string;
}

export function MediaUploader({ label = 'Upload media', accept = 'image/*,video/*,audio/*', signEvent, onUploaded, className = '' }: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [serverUsed, setServerUsed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    setLastFile(file);
    setError(null);
    setUploading(true);
    setProgress(0);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPreview(String(reader.result || null));
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    try {
      const result = await uploadMediaWithFallback(file, signEvent, setProgress);
      setServerUsed(result.server);
      onUploaded(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`rounded-lg border border-cyan-500/20 bg-slate-950/40 p-3 space-y-3 ${className}`}>
      <div
        className={`border border-dashed rounded-lg p-4 text-center transition ${dragging ? 'border-cyan-300 bg-cyan-500/10' : 'border-slate-600'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void onFile(e.dataTransfer.files?.[0]);
        }}
      >
        <p className="text-sm text-cyan-100">{label}</p>
        <p className="text-xs text-slate-400 mt-1">Drag & drop a file here or choose one manually.</p>
        <button type="button" className="cy-btn-secondary text-xs mt-3" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? 'Uploading…' : 'Choose file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>

      {uploading ? (
        <div className="space-y-1">
          <div className="h-2 rounded bg-slate-800 overflow-hidden">
            <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-cyan-200">Uploading… {progress}%</p>
        </div>
      ) : null}

      {preview ? <img src={preview} alt="Upload preview" className="w-28 h-28 object-cover rounded border border-slate-700" /> : null}
      {serverUsed ? <p className="text-xs text-emerald-300">Uploaded via: {serverUsed}</p> : null}

      {error ? (
        <div className="rounded border border-red-400/40 bg-red-950/40 p-2">
          <p className="text-xs text-red-200">{error}</p>
          <button type="button" className="cy-btn-secondary text-xs mt-2" onClick={() => void onFile(lastFile || undefined)} disabled={!lastFile || uploading}>
            Retry upload
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default MediaUploader;
