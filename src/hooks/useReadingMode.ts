import { useState, useCallback, useEffect } from 'react';
import type { ReadingMode, ViewportMode } from '../types';

const READING_MODE_KEY = 'relata-reading-mode';
const VIEWPORT_MODE_KEY = 'relata-reader-viewport';

export function useReadingMode() {
  const [readingMode, setReadingModeState] = useState<ReadingMode>(() => {
    const stored = localStorage.getItem(READING_MODE_KEY);
    return stored === 'horizontal' ? 'horizontal' : 'vertical';
  });

  const [viewportMode, setViewportModeState] = useState<ViewportMode>(() => {
    const stored = localStorage.getItem(VIEWPORT_MODE_KEY);
    return stored === 'mobile' ? 'mobile' : 'web';
  });

  useEffect(() => {
    document.body.setAttribute('data-reading-mode', readingMode);
  }, [readingMode]);

  useEffect(() => {
    document.body.setAttribute('data-viewport-mode', viewportMode);
  }, [viewportMode]);

  const setReadingMode = useCallback((mode: ReadingMode) => {
    setReadingModeState(mode);
    localStorage.setItem(READING_MODE_KEY, mode);
  }, []);

  const setViewportMode = useCallback((mode: ViewportMode) => {
    setViewportModeState(mode);
    localStorage.setItem(VIEWPORT_MODE_KEY, mode);
  }, []);

  return {
    readingMode,
    viewportMode,
    setReadingMode,
    setViewportMode,
  };
}

