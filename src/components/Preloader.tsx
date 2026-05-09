import { useState, useEffect, useRef, useCallback } from 'react';
import { GLOBE_CUSTOM_EQUIRECTANGULAR_URL } from '../config/globeAssets';
import { HOME_AUDIO_CONFIG } from '../config/audio';
import './Preloader.css';

interface PreloaderProps {
  onReady: () => void;
}

interface AssetStatus {
  total: number;
  loaded: number;
  label: string;
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

function preloadAudio(src: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'auto';

    const done = () => {
      audio.removeEventListener('canplaythrough', done);
      audio.removeEventListener('error', done);
      resolve();
    };

    audio.addEventListener('canplaythrough', done, { once: true });
    audio.addEventListener('error', done, { once: true });

    audio.src = src;
    audio.load();
  });
}

function resolveAssetPath(path: string): string {
  if (!path) return path;
  if (path.startsWith('/') || path.startsWith('data:') || path.startsWith('http')) {
    return path;
  }
  return `/${path}`;
}

export function Preloader({ onReady }: PreloaderProps) {
  const [status, setStatus] = useState<AssetStatus>({ total: 0, loaded: 0, label: 'Preparing world...' });
  const [fadeOut, setFadeOut] = useState(false);
  const startedRef = useRef(false);

  const startLoading = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    const criticalAssets: Array<{ type: 'image' | 'audio'; src: string; label: string }> = [];

    if (GLOBE_CUSTOM_EQUIRECTANGULAR_URL) {
      criticalAssets.push({ type: 'image', src: GLOBE_CUSTOM_EQUIRECTANGULAR_URL, label: 'Loading world texture...' });
    }

    criticalAssets.push({ type: 'audio', src: HOME_AUDIO_CONFIG.src, label: 'Loading theme...' });

    try {
      const storiesRes = await fetch('/stories.json', { cache: 'no-store' });
      if (storiesRes.ok) {
        const stories = await storiesRes.json();
        for (const story of stories) {
          if (story.cover) {
            criticalAssets.push({ type: 'image', src: resolveAssetPath(story.cover), label: `Loading ${story.title}...` });
          }
          if (story.audio) {
            criticalAssets.push({ type: 'audio', src: resolveAssetPath(story.audio), label: `Loading audio...` });
          }
        }
      }
    } catch {
      // stories.json will be loaded again by the app
    }

    const total = criticalAssets.length;
    setStatus({ total, loaded: 0, label: criticalAssets[0]?.label || 'Loading...' });

    let loaded = 0;

    const batchSize = 4;
    for (let i = 0; i < criticalAssets.length; i += batchSize) {
      const batch = criticalAssets.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (asset) => {
          if (asset.type === 'image') {
            await preloadImage(asset.src);
          } else {
            await preloadAudio(asset.src);
          }
          loaded++;
          const nextAsset = criticalAssets[Math.min(loaded, criticalAssets.length - 1)];
          setStatus({ total, loaded, label: loaded >= total ? 'Ready' : nextAsset?.label || 'Loading...' });
        })
      );
    }

    setFadeOut(true);
    setTimeout(() => {
      onReady();
    }, 600);
  }, [onReady]);

  useEffect(() => {
    startLoading();
  }, [startLoading]);

  const progress = status.total > 0 ? Math.round((status.loaded / status.total) * 100) : 0;

  return (
    <div className={`preloader ${fadeOut ? 'preloader-fade-out' : ''}`}>
      <div className="preloader-content">
        <h1 className="preloader-title">FARA U. 31</h1>
        <div className="preloader-spinner">
          <svg viewBox="0 0 50 50" className="preloader-ring">
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="none"
              stroke="rgba(194, 211, 205, 0.15)"
              strokeWidth="2"
            />
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="none"
              stroke="rgba(194, 211, 205, 0.7)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="125.6"
              strokeDashoffset={125.6 * (1 - progress / 100)}
              className="preloader-ring-progress"
            />
          </svg>
          <span className="preloader-percent">{progress}%</span>
        </div>
        <p className="preloader-label">{status.label}</p>
      </div>
    </div>
  );
}
