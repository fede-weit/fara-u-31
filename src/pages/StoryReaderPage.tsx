import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTheme, useReadingMode, useAudio } from '../hooks';
import type { Story, ReadingMode, ViewportMode, Theme } from '../types';

interface SpreadMeta {
  index: number;
  pageIndices: number[];
  type: 'single' | 'double';
}

const FLIP_SOUND_DURATION = 0.35;

// Resolve asset paths to absolute URLs
function resolveAssetPath(path: string): string {
  if (!path) return path;
  // Already absolute or data URL
  if (path.startsWith('/') || path.startsWith('data:') || path.startsWith('http')) {
    return path;
  }
  // Prepend / to make it absolute from public folder
  return `/${path}`;
}

export function StoryReaderPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [imageZoom, setImageZoom] = useState(1);
  const [zoomPanX, setZoomPanX] = useState(0);
  const [zoomPanY, setZoomPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartY, setPanStartY] = useState(0);

  const { theme, setTheme } = useTheme();
  const { readingMode, viewportMode, setReadingMode, setViewportMode } = useReadingMode();

  const flipAudioContextRef = useRef<AudioContext | null>(null);
  const spreadRefs = useRef<(HTMLDivElement | null)[]>([]);
  const galleryRef = useRef<HTMLDivElement | null>(null);

  // Audio setup
  const audioConfig = story?.audio
    ? { src: resolveAssetPath(story.audio), settings: story.audioSettings, autoplay: true }
    : { src: '', autoplay: false };

  const { isPlaying, isReady, toggle } = useAudio(audioConfig);

  // Load story
  useEffect(() => {
    if (!storyId) {
      setLoading(false);
      return;
    }

    async function fetchStory() {
      try {
        const response = await fetch('/stories.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const stories: Story[] = await response.json();
        const found = stories.find((s) => s.id === storyId);

        if (found) {
          setStory(found);
          // Apply preferred theme if no override
          const storedTheme = localStorage.getItem('relata-theme');
          if (!storedTheme && found.preferredTheme) {
            setTheme(found.preferredTheme, false);
          }
        }
      } catch (error) {
        console.error('Failed to load story', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStory();
  }, [storyId, setTheme]);

  // Calculate spreads
  const spreads: SpreadMeta[] = [];
  const gallery = story?.gallery || [];

  if (gallery.length > 1) {
    for (let i = 0; i < gallery.length; i += 2) {
      const pageIndices = [i];
      if (i + 1 < gallery.length) {
        pageIndices.push(i + 1);
      }
      spreads.push({
        index: spreads.length,
        pageIndices,
        type: pageIndices.length === 2 ? 'double' : 'single',
      });
    }
  } else if (gallery.length === 1) {
    spreads.push({ index: 0, pageIndices: [0], type: 'single' });
  }

  const playFlipSound = useCallback((direction: 'forward' | 'backward') => {
    if (!flipAudioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      flipAudioContextRef.current = new AudioContextClass();
    }

    const context = flipAudioContextRef.current;
    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }

    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * FLIP_SOUND_DURATION), context.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < channel.length; i++) {
      const progress = i / channel.length;
      const noise = Math.random() * 2 - 1;
      const envelope = Math.pow(1 - progress, 2);
      channel[i] = noise * envelope * 0.6;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = direction === 'backward' ? 760 : 900;
    filter.Q.value = 1.25;

    const gain = context.createGain();
    const startTime = context.currentTime;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.18, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + FLIP_SOUND_DURATION);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    source.start();
    source.stop(startTime + FLIP_SOUND_DURATION);
  }, []);

  const changeSpread = useCallback((targetIndex: number) => {
    if (readingMode !== 'horizontal') return;
    if (targetIndex < 0 || targetIndex >= spreads.length) return;
    if (targetIndex === currentSpreadIndex) return;

    const direction = targetIndex > currentSpreadIndex ? 'forward' : 'backward';
    setCurrentSpreadIndex(targetIndex);
    playFlipSound(direction);
  }, [readingMode, spreads.length, currentSpreadIndex, playFlipSound]);

  // Zoom handlers
  const handleImageWheel = useCallback((event: WheelEvent) => {
    if (!galleryRef.current?.contains(event.target as Node)) return;
    
    event.preventDefault();
    
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    setImageZoom((prev) => {
      const newZoom = prev * delta;
      return Math.min(Math.max(newZoom, 1), 5);
    });
  }, []);

  const handleImageMouseDown = useCallback((event: MouseEvent) => {
    if (imageZoom <= 1 || !galleryRef.current?.contains(event.target as Node)) return;
    
    setIsPanning(true);
    setPanStartX(event.clientX - zoomPanX);
    setPanStartY(event.clientY - zoomPanY);
  }, [imageZoom, zoomPanX, zoomPanY]);

  const handleImageMouseMove = useCallback((event: MouseEvent) => {
    if (!isPanning || imageZoom <= 1) return;
    
    const newX = event.clientX - panStartX;
    const newY = event.clientY - panStartY;
    
    setZoomPanX(newX);
    setZoomPanY(newY);
  }, [isPanning, imageZoom, panStartX, panStartY]);

  const handleImageMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Double click to reset zoom
  const handleImageDoubleClick = useCallback(() => {
    setImageZoom(1);
    setZoomPanX(0);
    setZoomPanY(0);
  }, []);

  // Setup zoom event listeners
  useEffect(() => {
    const element = galleryRef.current;
    if (!element) return;

    const wheelHandler = (e: WheelEvent) => handleImageWheel(e);
    const mouseDownHandler = (e: MouseEvent) => handleImageMouseDown(e);
    const mouseMoveHandler = (e: MouseEvent) => handleImageMouseMove(e);
    const mouseUpHandler = (_e: MouseEvent) => handleImageMouseUp();
    const doubleClickHandler = (_e: MouseEvent) => handleImageDoubleClick();

    element.addEventListener('wheel', wheelHandler, { passive: false });
    element.addEventListener('mousedown', mouseDownHandler);
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
    element.addEventListener('dblclick', doubleClickHandler);

    return () => {
      element.removeEventListener('wheel', wheelHandler);
      element.removeEventListener('mousedown', mouseDownHandler);
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
      element.removeEventListener('dblclick', doubleClickHandler);
    };
  }, [handleImageWheel, handleImageMouseDown, handleImageMouseMove, handleImageMouseUp, handleImageDoubleClick]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (readingMode !== 'horizontal' || spreads.length === 0) return;
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, button, [contenteditable="true"]')) {
        return;
      }

      if (event.key === 'ArrowRight') {
        changeSpread(currentSpreadIndex + 1);
        event.preventDefault();
      } else if (event.key === 'ArrowLeft') {
        changeSpread(currentSpreadIndex - 1);
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [readingMode, spreads.length, currentSpreadIndex, changeSpread]);

  const handleGalleryClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (readingMode !== 'horizontal' || spreads.length <= 1) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;

    const goForward = event.clientX - bounds.left >= bounds.width / 2;
    changeSpread(goForward ? currentSpreadIndex + 1 : currentSpreadIndex - 1);
  };

  // Page indicator text
  const getPageIndicatorText = () => {
    if (readingMode !== 'horizontal') {
      const total = gallery.length;
      return total ? `${total} tavola${total === 1 ? '' : 'e'}` : '0 tavole';
    }

    if (spreads.length === 0) return '0 / 0';

    const meta = spreads[currentSpreadIndex];
    const totalPages = gallery.length;

    if (meta) {
      const start = meta.pageIndices[0] + 1;
      const end = meta.pageIndices[meta.pageIndices.length - 1] + 1;
      const label = start === end ? `${start}` : `${start}–${end}`;
      return `${label} / ${totalPages}`;
    }

    return `1 / ${totalPages}`;
  };

  if (loading) {
    return (
      <div className="loading">
        <p>Caricamento...</p>
      </div>
    );
  }

  if (!story) {
    return (
      <main className="story-wrapper">
        <h1>Seleziona una storia</h1>
        <p>Apri questa pagina utilizzando un id valido.</p>
        <p>Controlla stories.json per gli identificativi disponibili.</p>
        <Link to="/" className="back-link">
          &larr; Torna alla mappa narrativa
        </Link>
      </main>
    );
  }

  return (
    <main className="story-wrapper">
      <Link to="/" className="back-link">
        &larr; Torna alla mappa narrativa
      </Link>

      <header className="story-header">
        <h1>{story.title}</h1>
        <p className="story-meta-line">
          <span>Epoca: <strong>{story.era ?? 'Epoca non definita'}</strong></span>
          <span>Temi: <strong>{story.themes?.join(', ') ?? 'Nessun tema specificato'}</strong></span>
        </p>
        <p>{story.summaryLong ?? story.summary}</p>
      </header>

      <section className="viewer-controls">
        <ToggleGroup
          label="Modalita lettura:"
          options={[
            { value: 'vertical', label: 'Scorrimento verticale' },
            { value: 'horizontal', label: 'Lettura a pagine' },
          ]}
          value={readingMode}
          onChange={(v) => setReadingMode(v as ReadingMode)}
        />

        <div className="viewer-switches">
          <ToggleGroup
            label="Tema:"
            options={[
              { value: 'dark', label: 'Manga scuro' },
              { value: 'light', label: 'Manga chiaro' },
            ]}
            value={theme}
            onChange={(v) => setTheme(v as Theme)}
          />

          <ToggleGroup
            label="Anteprima:"
            options={[
              { value: 'web', label: 'Desktop' },
              { value: 'mobile', label: 'Mobile' },
            ]}
            value={viewportMode}
            onChange={(v) => setViewportMode(v as ViewportMode)}
          />
        </div>

        <button
          type="button"
          className="audio-toggle"
          onClick={toggle}
          aria-pressed={!isPlaying}
          disabled={!isReady || !story.audio}
        >
          {isPlaying ? 'Disattiva audio' : 'Riattiva audio'}
        </button>

        {imageZoom > 1 && (
          <button
            type="button"
            className="audio-toggle"
            onClick={() => {
              setImageZoom(1);
              setZoomPanX(0);
              setZoomPanY(0);
            }}
            title="Ripristina zoom"
          >
            Ripristina zoom
          </button>
        )}
      </section>

      <section className="story-gallery" ref={galleryRef}>
        {/* Vertical Gallery */}
        <div
          className="story-gallery-vertical"
          style={{ display: readingMode === 'vertical' ? 'flex' : 'none' }}
        >
          {gallery.map((page, index) => (
            <figure key={index} data-page-index={index} className="story-image-container">
              <img
                src={resolveAssetPath(page.src)}
                alt={page.alt ?? `Tavola ${index + 1}`}
                loading="lazy"
                decoding="async"
                style={{
                  transform: `scale(${imageZoom}) translate(${zoomPanX / imageZoom}px, ${zoomPanY / imageZoom}px)`,
                  cursor: imageZoom > 1 ? 'grab' : 'zoom-in',
                  transition: isPanning ? 'none' : 'transform 0.2s ease-out',
                }}
              />
              {page.caption && <figcaption>{page.caption}</figcaption>}
            </figure>
          ))}
        </div>

        {/* Horizontal Gallery */}
        <div
          className="story-gallery-horizontal"
          style={{ display: readingMode === 'horizontal' && spreads.length > 0 ? 'grid' : 'none' }}
          onClick={handleGalleryClick}
        >
          {spreads.map((spread, spreadIndex) => (
            <div
              key={spreadIndex}
              ref={(el) => { spreadRefs.current[spreadIndex] = el; }}
              className={`story-spread ${getSpreadAnimationClass(spreadIndex, currentSpreadIndex)}`}
              data-spread-index={spreadIndex}
              data-spread-type={spread.type}
              data-story-single={gallery.length === 1 ? 'true' : undefined}
              data-active={spreadIndex === currentSpreadIndex ? 'true' : 'false'}
              style={{ zIndex: spreads.length - spreadIndex }}
            >
              {spread.pageIndices.map((pageIndex) => {
                const page = gallery[pageIndex];
                if (!page) return null;

                return (
                  <figure key={pageIndex} className="story-page story-image-container">
                    <img
                      src={resolveAssetPath(page.src)}
                      alt={page.alt ?? `Tavola ${pageIndex + 1}`}
                      loading="lazy"
                      decoding="async"
                      style={{
                        transform: `scale(${imageZoom}) translate(${zoomPanX / imageZoom}px, ${zoomPanY / imageZoom}px)`,
                        cursor: imageZoom > 1 ? 'grab' : 'zoom-in',
                        transition: isPanning ? 'none' : 'transform 0.2s ease-out',
                      }}
                    />
                    {page.caption && <figcaption>{page.caption}</figcaption>}
                  </figure>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {readingMode === 'horizontal' && spreads.length > 1 && (
        <div className="page-controls">
          <button
            type="button"
            className="page-control"
            onClick={() => changeSpread(currentSpreadIndex - 1)}
            disabled={currentSpreadIndex <= 0}
            aria-label="Mostra la pagina precedente"
          >
            Pagina precedente
          </button>
          <span className="page-indicator">{getPageIndicatorText()}</span>
          <button
            type="button"
            className="page-control"
            onClick={() => changeSpread(currentSpreadIndex + 1)}
            disabled={currentSpreadIndex >= spreads.length - 1}
            aria-label="Mostra la pagina successiva"
          >
            Pagina successiva
          </button>
        </div>
      )}
    </main>
  );
}

// Helper component for toggle groups
interface ToggleOption {
  value: string;
  label: string;
}

interface ToggleGroupProps {
  label: string;
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
}

function ToggleGroup({ label, options, value, onChange }: ToggleGroupProps) {
  return (
    <div className="toggle-group" role="group" aria-label={label}>
      <span className="toggle-group-label">{label}</span>
      <div className="toggle-buttons">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`toggle-button ${value === option.value ? 'is-active' : ''}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Helper function for animation classes
function getSpreadAnimationClass(_spreadIndex: number, _currentIndex: number): string {
  // Animation classes will be handled via CSS transitions based on data-active
  return '';
}

