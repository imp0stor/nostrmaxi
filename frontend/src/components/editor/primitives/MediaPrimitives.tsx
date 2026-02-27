import type { ClipboardEvent, DragEvent } from 'react';
import type { MediaItem, MediaType } from '../types';

interface UploadProps { value: string; onChange: (url: string) => void; onFileDrop?: (fileName: string) => void; label: string; accept: string }

const prevent = (e: DragEvent | ClipboardEvent) => { e.preventDefault(); };

const Uploader = ({ value, onChange, onFileDrop, label, accept }: UploadProps) => (
  <section aria-label={label} onDragOver={prevent} onDrop={(e)=>{prevent(e); const name=e.dataTransfer.files?.[0]?.name; if(name&&onFileDrop) onFileDrop(name);}} onPaste={(e)=>{const txt=e.clipboardData.getData('text'); if(txt) onChange(txt);}}>
    <label>{label}<input aria-label={`${label} url`} value={value} onChange={(e)=>onChange(e.target.value)} placeholder="https://" /></label>
    <small>Supports drag-drop, paste, URL ({accept})</small>
  </section>
);

export const ImageUploader = (props: Omit<UploadProps,'label'|'accept'>) => <Uploader {...props} label="Image uploader" accept="image/*" />;
export const VideoUploader = (props: Omit<UploadProps,'label'|'accept'>) => <Uploader {...props} label="Video uploader" accept="video/*" />;
export const AudioUploader = (props: Omit<UploadProps,'label'|'accept'>) => <Uploader {...props} label="Audio uploader" accept="audio/*" />;

export const MediaPreview = ({ item }: { item: MediaItem }) => <article aria-label={`media-preview-${item.type}`}><strong>{item.type}</strong> {item.url}</article>;

export const MediaGallery = ({ items, onRemove }: { items: MediaItem[]; onRemove: (id: string) => void }) => (
  <section aria-label="media gallery">
    {items.map((item)=> <div key={item.id}><MediaPreview item={item} /><button aria-label={`remove-${item.id}`} onClick={()=>onRemove(item.id)}>Remove</button></div>)}
    {!items.length && <p>No media added.</p>}
  </section>
);

export const createMediaItem = (type: MediaType, url: string): MediaItem => ({ id: `${type}-${Date.now()}`, type, url });
