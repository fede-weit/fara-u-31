import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import HTMLFlipBook from 'react-pageflip';
import type { Story } from '../types';
import './FullscreenReader.css';

interface FullscreenReaderProps {
  story: Story;
  onClose: () => void;
}

// Resolve asset paths to absolute URLs
function resolveAssetPath(path: string): string {
  if (!path) return path;
  if (path.startsWith('/') || path.startsWith('data:') || path.startsWith('http')) {
    return path;
  }
  return `/${path}`;
}

export function FullscreenReader({ story, onClose }: FullscreenReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const gallery = story.gallery || [];
  const renderedPageCount = useMemo(
    () => gallery.length + (gallery.length > 1 && gallery.length % 2 !== 0 ? 1 : 0),
    [gallery.length]
  );

  // Enter fullscreen on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const enterFullscreen = async () => {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        }
      } catch (err) {
        console.log('Fullscreen not available, using overlay mode');
      }
    };

    enterFullscreen();

    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (!isFs) {
        onClose();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [onClose]);

  const handleClose = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if ((document as any).webkitFullscreenElement) {
        await (document as any).webkitExitFullscreen();
      }
    } catch (err) {
      // Ignore
    }
    onClose();
  }, [onClose]);

  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < renderedPageCount - 1;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight' && canGoNext) {
        bookRef.current?.pageFlip()?.flipNext();
      } else if (e.key === 'ArrowLeft' && canGoPrev) {
        bookRef.current?.pageFlip()?.flipPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canGoNext, canGoPrev, handleClose]);

  if (gallery.length === 0) {
    return (
      <div ref={containerRef} className="fullscreen-reader">
        <button className="reader-close" onClick={handleClose}>✕</button>
        <div className="reader-empty">
          <h2>{story.title}</h2>
          <p>This story has no pages yet.</p>
        </div>
      </div>
    );
  }

  // Single image view for stories with only one image
  if (gallery.length === 1) {
    return (
      <div ref={containerRef} className="fullscreen-reader">
        {/* Background */}
        <div className="reader-background" />

        {/* Close button */}
        <button className="reader-close" onClick={handleClose}>
          ✕
        </button>

        {/* Single image wrapper */}
        <div className="single-image-wrapper">
          <img
            src={resolveAssetPath(gallery[0].src)}
            alt={gallery[0].alt || `${story.title}`}
            className="single-image"
            draggable={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="fullscreen-reader">
      {/* Background */}
      <div className="reader-background" />

      {/* Close button */}
      <button className="reader-close" onClick={handleClose}>
        ✕
      </button>
      
      {/* Book */}
      <div className="book-wrapper">
        {/* @ts-ignore - react-pageflip types issue */}
        <HTMLFlipBook 
          ref={bookRef}
          width={400} 
          height={550}
          maxShadowOpacity={0.5}
          drawShadow={true}
          showCover={false}
          size="stretch"
          minWidth={280}
          maxWidth={600}
          minHeight={400}
          maxHeight={800}
          mobileScrollSupport={false}
          className="flip-book"
          flippingTime={1000}
          usePortrait={false}
          startZIndex={0}
          autoSize={true}
          useMouseEvents={true}
          swipeDistance={30}
          clickEventForward={true}
          startPage={0}
          showPageCorners={true}
          disableFlipByClick={false}
          onFlip={(e: any) => setCurrentPage(e?.data ?? 0)}
        >
          {gallery.map((page, index) => (
            <div className="page" key={index}>
              <div className="page-content">
                <img
                  src={resolveAssetPath(page.src)}
                  alt={page.alt || `Page ${index + 1}`}
                  draggable={false}
                />
              </div>
            </div>
          ))}
          {/* Add empty page if odd number to complete the spread */}
          {gallery.length % 2 !== 0 && (
            <div className="page">
              <div className="page-content page-empty">
                <span>The End</span>
              </div>
            </div>
          )}
        </HTMLFlipBook>
      </div>

      {/* Navigation buttons */}
      <div className="reader-nav">
        <button 
          className="nav-button"
          onClick={() => bookRef.current?.pageFlip()?.flipPrev()}
          disabled={!canGoPrev}
        >
          ‹ Previous
        </button>
        <button 
          className="nav-button"
          onClick={() => bookRef.current?.pageFlip()?.flipNext()}
          disabled={!canGoNext}
        >
          Next ›
        </button>
      </div>

      {/* Instructions */}
      <div className="reader-instruction">
        Drag page corners, use arrows, or tap the controls
      </div>
    </div>
  );
}
