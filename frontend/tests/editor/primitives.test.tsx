import React from 'react';
import {
  BlockquoteControl,
  CategorySelector,
  CodeBlockControl,
  CodeEditor,
  DividerControl,
  EmbedPreview,
  EmbedSelector,
  EventCreator,
  HashtagSuggest,
  HeadingControl,
  ImageUploader,
  ListControl,
  LocationSelector,
  MediaGallery,
  MediaPreview,
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
  AudioUploader,
  VisibilityControl,
  inferEmbedPlatform,
  createMediaItem,
} from '../../../frontend/src/components/editor/primitives';

const expectElement = (el: React.ReactElement, type?: unknown) => {
  expect(React.isValidElement(el)).toBe(true);
  if (type !== undefined) expect(el.type).toBe(type);
};

describe('editor primitives', () => {
  it('renders text primitives', () => {
    expectElement(TitleInput({ value: 'x', onChange: () => undefined }), 'label');
    expectElement(SummaryInput({ value: 'x', onChange: () => undefined }), 'label');
    expectElement(PlainTextEditor({ value: 'x', onChange: () => undefined }), 'label');
    expectElement(RichTextEditor({ value: 'x', onChange: () => undefined }), 'label');
    expectElement(CodeEditor({ value: 'x', onChange: () => undefined }), 'label');
  });

  it('renders media primitives', () => {
    expectElement(ImageUploader({ value: '', onChange: () => undefined }));
    expectElement(VideoUploader({ value: '', onChange: () => undefined }));
    expectElement(AudioUploader({ value: '', onChange: () => undefined }));
    expectElement(MediaPreview({ item: { id: '1', type: 'image', url: 'https://img' } }), 'article');
    expectElement(MediaGallery({ items: [], onRemove: () => undefined }), 'section');
    expect(createMediaItem('audio', 'https://audio').type).toBe('audio');
  });

  it('renders embed primitives', () => {
    expect(inferEmbedPlatform('https://youtube.com/watch?v=1')).toBe('youtube');
    expectElement(EmbedSelector({ value: 'generic', onChange: () => undefined }), 'label');
    expectElement(URLEmbed({ value: '', onChange: () => undefined }), 'label');
    expectElement(EmbedPreview({ embed: { id: '1', platform: 'generic', url: 'https://x' } }), 'article');
  });

  it('renders structure primitives', () => {
    expectElement(HeadingControl({ level: 2, onChange: () => undefined }), 'label');
    expectElement(ListControl({ ordered: false, onChange: () => undefined }), 'button');
    expectElement(BlockquoteControl({ active: false, onToggle: () => undefined }), 'button');
    expectElement(CodeBlockControl({ language: 'ts', onChange: () => undefined }), 'label');
    expectElement(DividerControl({ onInsert: () => undefined }), 'button');
  });

  it('renders interactive primitives', () => {
    expectElement(PollCreator({ options: [{ id: '1', text: 'yes' }], durationHours: 12, onOptionChange: () => undefined, onAddOption: () => undefined, onDurationChange: () => undefined }), 'section');
    expectElement(EventCreator({ event: { title: '', startAt: '' }, onChange: () => undefined }), 'section');
    expectElement(LocationSelector({ value: '', onChange: () => undefined }), 'input');
    expectElement(HashtagSuggest({ value: '', suggestions: ['#nostr'], onChange: () => undefined, onPick: () => undefined }), 'section');
    expectElement(MentionAutocomplete({ value: '', suggestions: ['npub1'], onChange: () => undefined, onPick: () => undefined }), 'section');
  });

  it('renders metadata primitives', () => {
    expectElement(TagEditor({ tags: [], onChange: () => undefined }), 'label');
    expectElement(CategorySelector({ categories: [], options: ['news'], onChange: () => undefined }), 'label');
    expectElement(PublishSettings({ value: { isDraft: true, publishNow: false }, onChange: () => undefined }), 'section');
    expectElement(VisibilityControl({ value: 'public', onChange: () => undefined }), 'label');
    expectElement(ScheduleControl({ value: undefined, onChange: () => undefined }), 'label');
  });
});
