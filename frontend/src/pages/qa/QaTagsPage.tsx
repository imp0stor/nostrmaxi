import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { QaTag } from '../../types/qa';

export function QaTagsPage() {
  const [tags, setTags] = useState<QaTag[]>([]);

  useEffect(() => {
    void api.listQaTags().then(setTags);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-slate-100">
      <h1 className="text-2xl font-bold text-orange-300 mb-6">Popular Tags</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tags.map((tag) => (
          <Link key={tag.tag} to={`/qa?tag=${encodeURIComponent(tag.tag)}&sort=recent`} className="rounded border border-slate-800 bg-black p-4 hover:border-orange-400 transition-colors">
            <div className="font-semibold text-orange-200">#{tag.tag}</div>
            <div className="text-sm text-slate-400">{tag.questionCount} questions</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
