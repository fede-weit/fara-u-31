import { useState, useEffect, useCallback, useRef } from 'react';
import { Globe } from '../components';
import { FullscreenReader } from '../components/FullscreenReader';
import { useStories, useAudio } from '../hooks';
import { HOME_AUDIO_CONFIG } from '../config/audio';
import { getStoryColor } from '../utils/stories';
import type { Story } from '../types';
import './HomePage.css';

export function HomePage() {
  const { stories, loading } = useStories();
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [readerStory, setReaderStory] = useState<Story | null>(null);
  const [isEnteringStory, setIsEnteringStory] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [globeResetKey, setGlobeResetKey] = useState(0);
  const [globeAutoRotate, setGlobeAutoRotate] = useState(true);
  const transitionTimeoutRef = useRef<number | null>(null);

  // Helper to resolve public asset paths (same logic used elsewhere)
  function resolveAssetPath(path: string): string {
    if (!path) return path;
    if (path.startsWith('/') || path.startsWith('data:') || path.startsWith('http')) {
      return path;
    }
    return `/${path}`;
  }

  // Current audio source/settings (we'll swap between home and story audio)
  const [currentAudioSrc, setCurrentAudioSrc] = useState<string>(HOME_AUDIO_CONFIG.src);
  const [currentAudioSettings, setCurrentAudioSettings] = useState<any | undefined>(undefined);
  const [wasPlayingBeforeReader, setWasPlayingBeforeReader] = useState(false);
  const homeIntroPlayedRef = useRef(false);

  const { isPlaying, isReady, toggle, play, allowAutoplay } = useAudio({
    src: currentAudioSrc,
    settings: currentAudioSettings,
    autoplay: true,
  });

  // One-screen home: no document scroll (panels scroll internally)
  useEffect(() => {
    document.documentElement.classList.add('home-viewport-lock');
    return () => document.documentElement.classList.remove('home-viewport-lock');
  }, []);

  // Select first story by default
  useEffect(() => {
    if (stories.length > 0 && !selectedStory) {
      setSelectedStory(stories[0]);
    }
  }, [stories, selectedStory]);

  // Start home theme as soon as the shell is ready (still subject to browser autoplay rules).
  useEffect(() => {
    if (loading || readerStory || homeIntroPlayedRef.current) return;
    homeIntroPlayedRef.current = true;
    allowAutoplay();
    play();
  }, [loading, readerStory, allowAutoplay, play]);

  const handleSelectStory = useCallback((story: Story) => {
    setSelectedStory(story);
    setMenuOpen(false);
  }, []);

  const handleOpenStory = useCallback((story: Story) => {
    // Save whether home audio was playing so we can restore it on close
    setWasPlayingBeforeReader(isPlaying);

    allowAutoplay();

    // Switch audio source to the story's soundtrack (if any)
    if (story.audio) {
      setCurrentAudioSrc(resolveAssetPath(story.audio));
      setCurrentAudioSettings(story.audioSettings ?? undefined);
    } else {
      setCurrentAudioSrc('');
      setCurrentAudioSettings(undefined);
    }

    setIsEnteringStory(true);
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
    }
    transitionTimeoutRef.current = window.setTimeout(() => {
      setReaderStory(story);
      setIsEnteringStory(false);
      transitionTimeoutRef.current = null;
    }, 420);
    setMenuOpen(false);
  }, [isPlaying, allowAutoplay]);

  const handleCloseReader = useCallback(() => {
    // Close reader
    setReaderStory(null);

    // Restore home audio source
    setCurrentAudioSrc(HOME_AUDIO_CONFIG.src);
    setCurrentAudioSettings(undefined);

    // If home audio was playing before opening the reader, resume it
    if (wasPlayingBeforeReader) {
      // play() may be a no-op if autoplay is blocked; the hook will also attempt autoplay
      play();
    }

    // Bump globe reset key so the globe will restore its initial camera/zoom
    setGlobeResetKey((k) => k + 1);
  }, [wasPlayingBeforeReader, play]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // Ensure playback switches appropriately when reader opens
  useEffect(() => {
    if (readerStory) {
      // Attempt to play story audio when reader opens
      play();
    }
  }, [readerStory, play]);

  if (loading) {
    return (
      <div className="loading">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className={`home-layout ${isEnteringStory ? 'is-entering-story' : ''}`}>
      {/* Left Panel - Info */}
      <aside className="info-panel">
        <div className="info-panel-masthead">
          <header className="branding">
            <h1>FARA U. 31</h1>
          </header>
        </div>

        <div className="info-panel-body">
        {/* Story Info */}
        <div
          className="story-info"
          style={
            selectedStory
              ? ({
                  '--story-accent':
                    selectedStory.markerColor || getStoryColor(selectedStory.id) || '#c2d3cd',
                } as React.CSSProperties)
              : undefined
          }
        >
          {selectedStory ? (
            <>
              <p className="story-kicker">Current location</p>
              <div className="story-header">
                <span
                  className="story-dot"
                  style={{
                    background:
                      selectedStory.markerColor || getStoryColor(selectedStory.id) || undefined,
                  }}
                />
                <div className="story-header-text">
                  {selectedStory.era ? (
                    <p className="story-era">{selectedStory.era}</p>
                  ) : null}
                  <h2
                    className="story-title"
                    style={{
                      color: selectedStory.markerColor || getStoryColor(selectedStory.id) || undefined,
                    }}
                  >
                    {selectedStory.title}
                  </h2>
                  {selectedStory.location?.name &&
                  selectedStory.location.name.trim() !== selectedStory.title.trim() ? (
                    <p className="story-location-sub">{selectedStory.location.name}</p>
                  ) : null}
                </div>
              </div>

              {selectedStory.tagline ? (
                <p className="story-tagline">{selectedStory.tagline}</p>
              ) : null}

              {selectedStory.summary ? (
                <p className="story-summary">{selectedStory.summary}</p>
              ) : null}

              {selectedStory.themes && selectedStory.themes.length > 0 ? (
                <div className="story-themes">
                  {selectedStory.themes.map((t, i) => (
                    <span key={i} className="theme-tag">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}

            </>
          ) : (
            <div className="no-selection">
              <p className="no-selection-title">No location selected</p>
              <p className="no-selection-hint">Spin the globe and pick a point, or use the index below.</p>
            </div>
          )}
        </div>

        {/* Stories Menu */}
        <div className="stories-nav">
          <button
            type="button"
            className={`stories-toggle ${menuOpen ? 'is-open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
          >
            <span className="stories-toggle-label">
              <span className="stories-toggle-title">Index</span>
              <span className="stories-toggle-meta">{stories.length} locations</span>
            </span>
            <span className="toggle-icon" aria-hidden>
              {menuOpen ? '−' : '+'}
            </span>
          </button>

          {menuOpen ? (
            <ul className="stories-list">
              {stories.map((story, index) => {
                const color = story.markerColor || getStoryColor(story.id);
                const isSelected = story.id === selectedStory?.id;
                const label = story.location?.name || story.title;
                const sub =
                  story.era?.trim() ||
                  (story.title.trim() !== label.trim() ? story.title : '');

                return (
                  <li key={story.id}>
                    <button
                      type="button"
                      className={`story-item ${isSelected ? 'is-selected' : ''}`}
                      style={{ '--story-accent': color || '#c2d3cd' } as React.CSSProperties}
                      onClick={() => handleSelectStory(story)}
                      onDoubleClick={() => handleOpenStory(story)}
                    >
                      <span className="item-index" aria-hidden>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="item-dot" style={{ background: color || undefined }} />
                      <span className="item-text">
                        <span className="item-name">{label}</span>
                        {sub ? <span className="item-sub">{sub}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        </div>
      </aside>

      {/* Globe Panel */}
      <main className="globe-panel">
        <Globe
          stories={stories}
          selectedId={selectedStory?.id ?? null}
          onSelect={handleSelectStory}
          onOpen={handleOpenStory}
          resetViewKey={globeResetKey}
          autoRotate={globeAutoRotate}
        />

        <div className="globe-corner-controls" role="toolbar" aria-label="Globe and audio controls">
          <button
            type="button"
            className="globe-control-btn"
            onClick={() => setGlobeAutoRotate((v) => !v)}
            aria-pressed={!globeAutoRotate}
            aria-label={
              globeAutoRotate
                ? 'Pause globe rotation'
                : 'Resume globe rotation'
            }
            title={globeAutoRotate ? 'Pause rotation' : 'Resume rotation'}
          >
            <span className="globe-control-icon" aria-hidden>
              {globeAutoRotate ? '⏸' : '↻'}
            </span>
          </button>
          <button
            type="button"
            className="globe-control-btn"
            onClick={toggle}
            disabled={!isReady}
            aria-pressed={!isPlaying}
            aria-label={isPlaying ? 'Mute music' : 'Enable music'}
            title={isPlaying ? 'Mute music' : 'Enable music'}
          >
            <GlobeVolumeIcon muted={!isPlaying} />
          </button>
        </div>

        {selectedStory?.gallery && selectedStory.gallery.length > 0 ? (
          <div className="globe-story-cta-wrap">
            <button
              type="button"
              className="globe-story-cta"
              onClick={() => handleOpenStory(selectedStory)}
            >
              <span>Visit location</span>
              <span className="globe-story-cta-icon" aria-hidden>
                →
              </span>
            </button>
          </div>
        ) : null}
      </main>

      {/* Fullscreen Reader */}
      {readerStory && (
        <FullscreenReader
          story={readerStory}
          onClose={handleCloseReader}
        />
      )}
    </div>
  );
}

/** Apple-style speaker + waves / speaker + X (muted) */
function GlobeVolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      className="globe-volume-svg"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden
      focusable="false"
    >
      <polygon fill="currentColor" points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {muted ? (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinecap="round"
          d="M16 9l6 6M22 9l-6 6"
        />
      ) : (
        <>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
            d="M15.54 8.46a5 5 0 0 1 0 7.07"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
            d="M19.07 4.93a10 10 0 0 1 0 14.14"
          />
        </>
      )}
    </svg>
  );
}
