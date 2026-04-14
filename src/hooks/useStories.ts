import { useState, useEffect } from 'react';
import type { Story } from '../types';
import { loadStories, enrichStories, assignMarkerColors } from '../utils/stories';

export function useStories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStories() {
      try {
        const data = await loadStories();
        if (cancelled) return;

        const enriched = enrichStories(data);
        const withColors = assignMarkerColors(enriched);
        setStories(withColors);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to load stories'));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchStories();

    return () => {
      cancelled = true;
    };
  }, []);

  return { stories, loading, error };
}

