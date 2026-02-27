import { useEffect, useState } from 'react';
import { extractGitHubRepo } from '../lib/richEmbeds';

interface RepoData {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  html_url: string;
  owner: { avatar_url: string; login: string };
}

export function GitHubRepoCard({ url }: { url: string }) {
  const repo = extractGitHubRepo(url);
  const [data, setData] = useState<RepoData | null>(null);

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`,
          { headers: { Accept: 'application/vnd.github+json' } });
        if (!response.ok) return;
        const json = (await response.json()) as RepoData;
        if (!cancelled) setData(json);
      } catch {
        // fallback to URL-only card
      }
    })();
    return () => { cancelled = true; };
  }, [repo?.owner, repo?.repo]);

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block rounded-md border border-slate-700/80 bg-[#0b1018] hover:border-slate-400/80 transition-colors p-3 space-y-2">
      <p className="text-[11px] uppercase tracking-wider text-slate-400">GitHub Repository</p>
      <div className="flex items-center gap-2">
        {data?.owner?.avatar_url ? <img src={data.owner.avatar_url} alt={data.owner.login} className="h-7 w-7 rounded-full" /> : null}
        <p className="text-sm font-semibold text-slate-100">{data?.full_name || (repo ? `${repo.owner}/${repo.repo}` : url)}</p>
      </div>
      <p className="text-sm text-slate-200/85 line-clamp-2">{data?.description || 'Open repository on GitHub'}</p>
      <div className="flex items-center gap-3 text-xs text-slate-300/90">
        <span>⭐ {typeof data?.stargazers_count === 'number' ? data.stargazers_count.toLocaleString() : '—'}</span>
        <span>🧠 {data?.language || 'Unknown'}</span>
      </div>
    </a>
  );
}
