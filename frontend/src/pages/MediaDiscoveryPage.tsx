import { useEffect, useMemo, useState } from 'react';
import { FilterBar } from '../components/filters/FilterBar';
import { useTagFilter } from '../hooks/useTagFilter';
import { ContentCreatorCard, type ContentCreator } from '../components/discovery/ContentCreatorCard';
import { MediaTypeFilter, type MediaType } from '../components/discovery/MediaTypeFilter';

export function MediaDiscoveryPage() {
  const [mediaType, setMediaType] = useState<MediaType>('all');
  const [creators, setCreators] = useState<ContentCreator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedTags, logic, setSelectedTags, setLogic } = useTagFilter({
    storageKey: 'nostrmaxi.media.tag-filter',
    defaultLogic: 'or',
  });

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    creators.forEach((creator) => creator.topics?.forEach((tag) => set.add(tag.toLowerCase())));
    return Array.from(set).slice(0, 40);
  }, [creators]);

  const fetchCreators = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      query.set('type', mediaType);
      query.set('limit', '36');
      if (selectedTags.length > 0) query.set('tags', selectedTags.join(','));
      const response = await fetch(`/api/v1/media-discovery/creators?${query.toString()}`);
      if (!response.ok) throw new Error(`Failed with ${response.status}`);
      const data = await response.json() as ContentCreator[];
      setCreators(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load creators');
      setCreators([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCreators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType]);

  const visibleCreators = useMemo(() => {
    if (selectedTags.length === 0) return creators;

    return creators.filter((creator) => {
      const topicSet = new Set((creator.topics || []).map((tag) => tag.toLowerCase()));
      if (logic === 'and') return selectedTags.every((tag) => topicSet.has(tag.toLowerCase()));
      return selectedTags.some((tag) => topicSet.has(tag.toLowerCase()));
    });
  }, [creators, selectedTags, logic]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="cy-card p-5">
        <p className="cy-kicker">DISCOVERY</p>
        <h1 className="cy-title">🎙️ Podcast & Media Discovery</h1>
        <p className="cy-muted mt-2">Find creators across Nostr, RSS, YouTube, and Value4Value ecosystems.</p>
      </header>

      <section className="cy-card p-5 space-y-4">
        <MediaTypeFilter value={mediaType} onChange={setMediaType} />
        <FilterBar
          title="Topic Filter"
          availableTags={availableTags}
          selectedTags={selectedTags}
          logic={logic}
          onTagsChange={setSelectedTags}
          onLogicChange={setLogic}
          onApply={() => void fetchCreators()}
        />
      </section>

      {loading ? <div className="cy-card p-6">Loading creators...</div> : null}
      {error ? <div className="cy-card p-6 text-red-300">{error}</div> : null}

      {!loading && !error ? (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleCreators.map((creator) => <ContentCreatorCard key={creator.pubkey} creator={creator} />)}
          {visibleCreators.length === 0 ? <div className="cy-card p-6 text-sm text-cyan-200">No creators found for this filter yet.</div> : null}
        </section>
      ) : null}
    </div>
  );
}
