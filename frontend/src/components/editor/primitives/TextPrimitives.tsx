import type { ChangeEvent } from 'react';

interface BaseProps { label: string; value: string; onChange: (value: string) => void; placeholder?: string; ariaLabel?: string }

const emit = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, onChange: (value: string) => void) => onChange(event.target.value);

export const TitleInput = ({ label='Title', value, onChange, placeholder='Add a title', ariaLabel='Title input' }: Partial<BaseProps> & Pick<BaseProps,'value'|'onChange'>) => (
  <label>
    {label}
    <input aria-label={ariaLabel} value={value} placeholder={placeholder} onChange={(e)=>emit(e,onChange)} />
  </label>
);

export const SummaryInput = ({ label='Summary', value, onChange, placeholder='Add a summary', ariaLabel='Summary input' }: Partial<BaseProps> & Pick<BaseProps,'value'|'onChange'>) => (
  <label>
    {label}
    <textarea aria-label={ariaLabel} value={value} placeholder={placeholder} onChange={(e)=>emit(e,onChange)} rows={3} />
  </label>
);

export const PlainTextEditor = ({ label='Text', value, onChange, placeholder='Write your post', ariaLabel='Plain text editor' }: Partial<BaseProps> & Pick<BaseProps,'value'|'onChange'>) => (
  <label>
    {label}
    <textarea aria-label={ariaLabel} value={value} placeholder={placeholder} onChange={(e)=>emit(e,onChange)} rows={8} />
  </label>
);

export const RichTextEditor = ({ label='Markdown', value, onChange, placeholder='Markdown supported', ariaLabel='Rich text editor' }: Partial<BaseProps> & Pick<BaseProps,'value'|'onChange'>) => (
  <label>
    {label}
    <textarea aria-label={ariaLabel} value={value} placeholder={placeholder} onChange={(e)=>emit(e,onChange)} rows={12} data-format="markdown" />
  </label>
);

export const CodeEditor = ({ label='Code', value, onChange, placeholder='Paste code', ariaLabel='Code editor' }: Partial<BaseProps> & Pick<BaseProps,'value'|'onChange'>) => (
  <label>
    {label}
    <textarea aria-label={ariaLabel} value={value} placeholder={placeholder} onChange={(e)=>emit(e,onChange)} rows={10} spellCheck={false} />
  </label>
);
