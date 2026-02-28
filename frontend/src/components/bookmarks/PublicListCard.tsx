import type { PublicCuratedList } from '../../hooks/usePublicLists';

interface PublicListCardProps {
  list: PublicCuratedList;
}

export function PublicListCard({ list }: PublicListCardProps) {
  return (
    <article className="cy-card p-4">
      <h4 className="text-cyan-100 font-semibold">📚 {list.title}</h4>
      {list.description ? <p className="text-sm text-cyan-300/80 mt-1">{list.description}</p> : null}
      <p className="text-xs text-cyan-400 mt-2">{list.eventIds.length} posts • Public</p>
    </article>
  );
}
