import { useState, useCallback, useEffect } from 'react';
import type { ReadingMode, ViewportMode } from '../types';

const READING_MODE_KEY = 'fara-u-31-reading-mode';
const VIEWPORT_MODE_KEY = 'fara-u-31-reader-viewport';
const LEGACY_READING_MODE_KEY = 'relata-reading-mode';
const LEGACY_VIEWPORT_MODE_KEY = 'relata-reader-viewport';

function readReadingMode(): ReadingMode {
  const parse = (key: string): ReadingMode | null => {
    const v = localStorage.getItem(key);
    return v === 'horizontal' || v === 'vertical' ? v : null;
  };
  let v = parse(READING_MODE_KEY);
  if (v) return v;
  v = parse(LEGACY_READING_MODE_KEY);
  if (v) {
    localStorage.setItem(READING_MODE_KEY, v);
    return v;
  }
  return 'vertical';
}

function readViewportMode(): ViewportMode {
  const parse = (key: string): ViewportMode | null => {
    const v = localStorage.getItem(key);
    return v === 'mobile' || v === 'web' ? v : null;
  };
  let v = parse(VIEWPORT_MODE_KEY);
  if (v) return v;
  v = parse(LEGACY_VIEWPORT_MODE_KEY);
  if (v) {
    localStorage.setItem(VIEWPORT_MODE_KEY, v);
    return v;
  }
  return 'web';
}

export function useReadingMode() {
  const [readingMode, setReadingModeState] = useState<ReadingMode>(readReadingMode);

  const [viewportMode, setViewportModeState] = useState<ViewportMode>(readViewportMode);

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

