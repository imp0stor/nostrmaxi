import type { PublishSettingsState, Visibility } from '../types';

export const TagEditor = ({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) => {
  const value = tags.join(', ');
  return <label>Tags<input aria-label="tag-editor" value={value} onChange={(e)=>onChange(e.target.value.split(',').map((v)=>v.trim()).filter(Boolean))} /></label>;
};

export const CategorySelector = ({ categories, options, onChange }: { categories: string[]; options: string[]; onChange: (categories: string[]) => void }) => (
  <label>Categories<select aria-label="category-selector" multiple value={categories} onChange={(e)=>onChange(Array.from(e.target.selectedOptions).map((option)=>option.value))}>{options.map((option)=><option key={option} value={option}>{option}</option>)}</select></label>
);

export const PublishSettings = ({ value, onChange }: { value: PublishSettingsState; onChange: (state: PublishSettingsState) => void }) => (
  <section aria-label="publish-settings">
    <label><input aria-label="publish-draft" type="checkbox" checked={value.isDraft} onChange={(e)=>onChange({ ...value, isDraft: e.target.checked })} /> Draft</label>
    <label><input aria-label="publish-now" type="checkbox" checked={value.publishNow} onChange={(e)=>onChange({ ...value, publishNow: e.target.checked })} /> Publish now</label>
  </section>
);

export const VisibilityControl = ({ value, onChange }: { value: Visibility; onChange: (visibility: Visibility) => void }) => (
  <label>Visibility<select aria-label="visibility-control" value={value} onChange={(e)=>onChange(e.target.value as Visibility)}>{['public','unlisted','followers','private'].map((v)=><option key={v} value={v}>{v}</option>)}</select></label>
);

export const ScheduleControl = ({ value, onChange }: { value?: string; onChange: (value?: string) => void }) => (
  <label>Schedule<input aria-label="schedule-control" type="datetime-local" value={value ?? ''} onChange={(e)=>onChange(e.target.value || undefined)} /></label>
);
