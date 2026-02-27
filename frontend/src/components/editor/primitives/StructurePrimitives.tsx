import type { ReactNode } from 'react';

export const HeadingControl = ({ level, onChange }: { level: 1|2|3|4|5|6; onChange: (level: 1|2|3|4|5|6) => void }) => <label>Heading<select aria-label="heading-level" value={level} onChange={(e)=>onChange(Number(e.target.value) as 1|2|3|4|5|6)}>{[1,2,3,4,5,6].map((l)=><option key={l} value={l}>H{l}</option>)}</select></label>;

export const ListControl = ({ ordered, onChange }: { ordered: boolean; onChange: (ordered: boolean) => void }) => <button aria-label="list-control" onClick={()=>onChange(!ordered)}>{ordered?'Ordered':'Unordered'}</button>;

export const BlockquoteControl = ({ active, onToggle }: { active: boolean; onToggle: () => void }) => <button aria-label="blockquote-control" onClick={onToggle}>{active?'Blockquote On':'Blockquote Off'}</button>;

export const CodeBlockControl = ({ language, onChange }: { language: string; onChange: (language: string) => void }) => <label>Language<input aria-label="code-language" value={language} onChange={(e)=>onChange(e.target.value)} /></label>;

export const DividerControl = ({ label='Insert divider', onInsert }: { label?: string; onInsert: () => void }) => <button aria-label="divider-control" onClick={onInsert}>{label}</button>;

export const StructureGroup = ({ children }: { children: ReactNode }) => <section aria-label="structure-controls">{children}</section>;
