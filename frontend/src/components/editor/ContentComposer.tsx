import { useMemo, useState } from 'react';
import { signEvent } from '../../lib/nostr';
import { MediaUploader } from '../MediaUploader';
import {
  AudioUploader,
  CategorySelector,
  EmbedPreview,
  EmbedSelector,
  EventCreator,
  HashtagSuggest,
  ImageUploader,
  MediaGallery,
  MentionAutocomplete,
  PlainTextEditor,
  PollCreator,
  PublishSettings,
  RichTextEditor,
  ScheduleControl,
  SummaryInput,
  TagEditor,
  TitleInput,
  URLEmbed,
  VideoUploader,
  VisibilityControl,
  createMediaItem,
  inferEmbedPlatform,
} from './primitives';
import { serializeToNostrDraft, validateEditorState } from './adapters/contentTypeAdapters';
import { useEditorState } from './state/useEditorState';
import { DEFAULT_EDITOR_STATE, onEditorShortcut, type ContentType } from './types';

const CONTENT_TYPES: ContentType[] = ['short-form', 'long-form', 'media', 'event', 'poll'];

export const ContentComposer = ({ draftKey = 'default' }: { draftKey?: string }) => {
  const { state, update, undo, redo, saveDraft } = useEditorState(draftKey, DEFAULT_EDITOR_STATE);
  const [previewMode, setPreviewMode] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [mentionInput, setMentionInput] = useState('');

  const validationErrors = useMemo(() => validateEditorState(state), [state]);
  const serialized = useMemo(() => serializeToNostrDraft(state), [state]);

  const addMedia = (type: 'image' | 'video' | 'audio', url: string) => {
    if (!url.trim()) return;
    update({ media: [...state.media, createMediaItem(type, url)] });
  };

  const addEmbed = () => {
    if (!embedUrl.trim()) return;
    const platform = inferEmbedPlatform(embedUrl);
    update({ embeds: [...state.embeds, { id: `${platform}-${Date.now()}`, platform, url: embedUrl }] });
    setEmbedUrl('');
  };

  return (
    <section
      aria-label="content-composer"
      tabIndex={0}
      onKeyDown={(event) => onEditorShortcut(event, { save: saveDraft, preview: () => setPreviewMode((p) => !p), undo, redo })}
    >
      <h2>Content Composer</h2>
      <label>
        Content Type
        <select aria-label="content-type" value={state.contentType} onChange={(e) => update({ contentType: e.target.value as ContentType })}>
          {CONTENT_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </label>

      {state.contentType === 'long-form' && (
        <>
          <TitleInput value={state.title} onChange={(title) => update({ title })} />
          <SummaryInput value={state.summary} onChange={(summary) => update({ summary })} />
          <RichTextEditor value={state.body} onChange={(body) => update({ body })} />
        </>
      )}

      {state.contentType === 'short-form' && <PlainTextEditor value={state.body} onChange={(body) => update({ body })} />}
      {state.contentType === 'media' && <PlainTextEditor value={state.body} onChange={(body) => update({ body })} placeholder="Describe your media post" />}

      {(state.contentType === 'short-form' || state.contentType === 'media' || state.contentType === 'long-form') && (
        <>
          <ImageUploader value="" onChange={(url) => addMedia('image', url)} />
          <VideoUploader value="" onChange={(url) => addMedia('video', url)} />
          <AudioUploader value="" onChange={(url) => addMedia('audio', url)} />
          <MediaUploader
            label="Upload via Blossom"
            signEvent={signEvent}
            onUploaded={(result) => {
              const mediaType = result.type.startsWith('video/') ? 'video' : result.type.startsWith('audio/') ? 'audio' : 'image';
              addMedia(mediaType, result.url);
            }}
          />
          <MediaGallery items={state.media} onRemove={(id) => update({ media: state.media.filter((item) => item.id !== id) })} />
          <EmbedSelector value={inferEmbedPlatform(embedUrl || 'https://example.com')} onChange={() => undefined} />
          <URLEmbed value={embedUrl} onChange={setEmbedUrl} />
          <button aria-label="add-embed" onClick={addEmbed}>Add embed</button>
          {state.embeds.map((embed) => <EmbedPreview key={embed.id} embed={embed} />)}
        </>
      )}

      {state.contentType === 'poll' && (
        <PollCreator
          options={state.pollOptions}
          durationHours={state.pollDurationHours}
          onOptionChange={(id, text) => update({ pollOptions: state.pollOptions.map((option) => option.id === id ? { ...option, text } : option) })}
          onAddOption={() => update({ pollOptions: [...state.pollOptions, { id: String(Date.now()), text: '' }] })}
          onDurationChange={(pollDurationHours) => update({ pollDurationHours })}
        />
      )}

      {state.contentType === 'event' && (
        <EventCreator
          event={state.event ?? { title: '', startAt: '', description: '' }}
          onChange={(event) => update({ event })}
        />
      )}

      <HashtagSuggest
        value={hashtagInput}
        suggestions={['#nostr', '#bitcoin', '#longform']}
        onChange={setHashtagInput}
        onPick={(tag) => update({ hashtags: [...new Set([...state.hashtags, tag])] })}
      />
      <MentionAutocomplete
        value={mentionInput}
        suggestions={['npub1alice', 'npub1bob']}
        onChange={setMentionInput}
        onPick={(mention) => update({ mentions: [...new Set([...state.mentions, mention])] })}
      />

      <TagEditor tags={state.tags} onChange={(tags) => update({ tags })} />
      <CategorySelector categories={state.categories} options={['news', 'tech', 'culture', 'events']} onChange={(categories) => update({ categories })} />
      <PublishSettings value={state.publishSettings} onChange={(publishSettings) => update({ publishSettings })} />
      <VisibilityControl value={state.visibility} onChange={(visibility) => update({ visibility })} />
      <ScheduleControl value={state.publishSettings.scheduledAt} onChange={(scheduledAt) => update({ publishSettings: { ...state.publishSettings, scheduledAt } })} />

      <button aria-label="preview-toggle" onClick={() => setPreviewMode((p) => !p)}>{previewMode ? 'Edit' : 'Preview'}</button>
      <button aria-label="save-draft" onClick={saveDraft}>Save Draft</button>

      {validationErrors.length > 0 && <ul aria-label="validation-errors">{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>}

      {previewMode && (
        <pre aria-label="nostr-preview">{JSON.stringify(serialized, null, 2)}</pre>
      )}
    </section>
  );
};

export default ContentComposer;
