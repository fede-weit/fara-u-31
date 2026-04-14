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
  const [menuOpen, setMenuOpen] = useState(false);
  const [globeResetKey, setGlobeResetKey] = useState(0);

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

    setReaderStory(story);
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
        <p>Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="home-layout">
      {/* Left Panel - Info */}
      <aside className="info-panel">
        <header className="branding">
          <span className="world-label">Universo condiviso</span>
          <h1>Relata Tales</h1>
        </header>

        {/* Story Info */}
        <div className="story-info">
          {selectedStory ? (
            <>
              <div className="story-header">
                <span 
                  className="story-dot"
                  style={{ background: selectedStory.markerColor || getStoryColor(selectedStory.id) || undefined }}
                />
                <div>
                  {selectedStory.era && (
                    <p className="story-era">{selectedStory.era}</p>
                  )}
                  <h2 
                    className="story-title"
                    style={{ color: selectedStory.markerColor || getStoryColor(selectedStory.id) || undefined }}
                  >
                    {selectedStory.title}
                  </h2>
                </div>
              </div>
              
              {selectedStory.tagline && (
                <p className="story-tagline">{selectedStory.tagline}</p>
              )}
              
              {selectedStory.summary && (
                <p className="story-summary">{selectedStory.summary}</p>
              )}
              
              {selectedStory.themes && selectedStory.themes.length > 0 && (
                <div className="story-themes">
                  {selectedStory.themes.map((t, i) => (
                    <span key={i} className="theme-tag">{t}</span>
                  ))}
                </div>
              )}
              
              {selectedStory.gallery && selectedStory.gallery.length > 0 && (
                <button 
                  className="open-story-btn"
                  onClick={() => handleOpenStory(selectedStory)}
                >
                  Leggi la storia
                </button>
              )}
            </>
          ) : (
            <p className="no-selection">Seleziona una location</p>
          )}
        </div>

        {/* Stories Menu */}
        <div className="stories-nav">
          <button 
            className={`stories-toggle ${menuOpen ? 'is-open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span>Storie</span>
            <span className="toggle-icon">{menuOpen ? '−' : '+'}</span>
          </button>
          
          {menuOpen && (
            <ul className="stories-list">
              {stories.map((story) => {
                const color = story.markerColor || getStoryColor(story.id);
                const isSelected = story.id === selectedStory?.id;
                
                return (
                  <li key={story.id}>
                    <button
                      className={`story-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleSelectStory(story)}
                      onDoubleClick={() => handleOpenStory(story)}
                    >
                      <span className="item-dot" style={{ background: color || undefined }} />
                      <span className="item-name">{story.location?.name || story.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
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
        />
        
        {/* Audio control */}
        <button 
          className="audio-control"
          onClick={toggle}
          disabled={!isReady}
          title={isPlaying ? 'Disattiva audio' : 'Attiva audio'}
        >
          {isPlaying ? '♪' : '♪̸'}
        </button>
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
