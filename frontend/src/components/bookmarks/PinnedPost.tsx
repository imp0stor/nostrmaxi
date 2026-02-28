interface PinnedPostProps {
  pinnedEventId?: string | null;
  onRemove?: () => Promise<void> | void;
}

export function PinnedPost({ pinnedEventId, onRemove }: PinnedPostProps) {
  return (
    <section className="cy-card p-4 space-y-3">
      <h3 className="text-cyan-100 font-semibold">📌 Profile Pinned Post</h3>
      {pinnedEventId ? (
        <>
          <p className="text-sm text-cyan-200 break-all">Pinned event: {pinnedEventId}</p>
          {onRemove ? <button className="cy-chip" onClick={() => void onRemove()}>Remove Pin</button> : null}
        </>
      ) : <p className="text-sm text-cyan-300/80">No pinned post yet.</p>}
    </section>
  );
}
