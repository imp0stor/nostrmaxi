import type { EventDetails, PollOption } from '../types';

export const PollCreator = ({ options, durationHours, onOptionChange, onAddOption, onDurationChange }: { options: PollOption[]; durationHours: number; onOptionChange: (id: string, value: string) => void; onAddOption: () => void; onDurationChange: (hours: number) => void }) => (
  <section aria-label="poll creator">
    {options.map((option)=><input key={option.id} aria-label={`poll-option-${option.id}`} value={option.text} onChange={(e)=>onOptionChange(option.id,e.target.value)} />)}
    <button aria-label="poll-add-option" onClick={onAddOption}>Add option</button>
    <label>Duration (hours)<input aria-label="poll-duration" type="number" min={1} value={durationHours} onChange={(e)=>onDurationChange(Number(e.target.value)||1)} /></label>
  </section>
);

export const EventCreator = ({ event, onChange }: { event: EventDetails; onChange: (event: EventDetails) => void }) => (
  <section aria-label="event creator">
    <input aria-label="event-title" value={event.title} onChange={(e)=>onChange({ ...event, title: e.target.value })} placeholder="Event title" />
    <input aria-label="event-start" type="datetime-local" value={event.startAt} onChange={(e)=>onChange({ ...event, startAt: e.target.value })} />
    <input aria-label="event-end" type="datetime-local" value={event.endAt ?? ''} onChange={(e)=>onChange({ ...event, endAt: e.target.value })} />
    <textarea aria-label="event-description" value={event.description ?? ''} onChange={(e)=>onChange({ ...event, description: e.target.value })} />
  </section>
);

export const LocationSelector = ({ value, onChange }: { value: string; onChange: (location: string) => void }) => <input aria-label="location-selector" value={value} onChange={(e)=>onChange(e.target.value)} placeholder="City, venue, or lat,long" />;

export const HashtagSuggest = ({ value, suggestions, onChange, onPick }: { value: string; suggestions: string[]; onChange: (value: string) => void; onPick: (value: string) => void }) => (
  <section aria-label="hashtag-suggest">
    <input aria-label="hashtag-input" value={value} onChange={(e)=>onChange(e.target.value)} placeholder="#nostr" />
    {suggestions.map((tag)=><button key={tag} aria-label={`hashtag-${tag}`} onClick={()=>onPick(tag)}>{tag}</button>)}
  </section>
);

export const MentionAutocomplete = ({ value, suggestions, onChange, onPick }: { value: string; suggestions: string[]; onChange: (value: string) => void; onPick: (value: string) => void }) => (
  <section aria-label="mention-autocomplete">
    <input aria-label="mention-input" value={value} onChange={(e)=>onChange(e.target.value)} placeholder="@npub..." />
    {suggestions.map((mention)=><button key={mention} aria-label={`mention-${mention}`} onClick={()=>onPick(mention)}>{mention}</button>)}
  </section>
);
