import { useState, useEffect, useCallback } from 'react';
import type { Theme } from '../types';

export const THEME_STORAGE_KEY = 'fara-u-31-theme';
const LEGACY_THEME_KEY = 'relata-theme';

function readStoredTheme(): string | null {
  const next = localStorage.getItem(THEME_STORAGE_KEY);
  if (next) return next;
  const legacy = localStorage.getItem(LEGACY_THEME_KEY);
  if (legacy === 'light' || legacy === 'dark') {
    localStorage.setItem(THEME_STORAGE_KEY, legacy);
    return legacy;
  }
  return null;
}

export function useTheme(initialTheme?: Theme) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = readStoredTheme();
    if (stored === 'light' || stored === 'dark') return stored;
    return initialTheme ?? 'dark';
  });

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme, store = true) => {
    setThemeState(newTheme);
    if (store) {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
