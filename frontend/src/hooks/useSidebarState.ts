import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'nostrmaxi-sidebar-collapsed';

function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) return false;
  return stored === 'true';
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState<boolean>(() => getInitialCollapsed());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return {
    collapsed,
    setCollapsed,
    toggleCollapsed,
  };
}
