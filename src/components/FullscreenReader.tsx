import { useRef, useEffect, useCallback, useState } from 'react';
import type { Story } from '../types';
import './FullscreenReader.css';

interface FullscreenReaderProps {
  story: Story;
  onClose: () => void;
}

function resolveAssetPath(path: string): string {
  if (!path) return path;
  if (path.startsWith('/') || path.startsWith('data:') || path.startsWith('http')) {
    return path;
  }
  return `/${path}`;
}

export function FullscreenReader({ story, onClose }: FullscreenReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const gallery = story.gallery || [];
  const totalPages = gallery.length;

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= totalPages) return;
    setCurrentPage(index);
    resetZoom();
  }, [totalPages, resetZoom]);

  // Wheel to zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((prev) => Math.min(Math.max(prev * factor, 1), 6));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Drag to pan (when zoomed)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
  }, [zoom, panX, panY]);

  useEffect(() => {
    if (!isPanning) return;

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanX(panStartRef.current.panX + dx);
      setPanY(panStartRef.current.panY + dy);
    };

    const onUp = () => setIsPanning(false);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isPanning]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        goTo(currentPage + 1);
      } else if (e.key === 'ArrowLeft') {
        goTo(currentPage - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentPage, goTo, onClose]);

  if (totalPages === 0) {
    return (
      <div className="fullscreen-reader">
        <button className="reader-close" onClick={onClose}>✕</button>
        <div className="reader-empty">
          <h2>{story.title}</h2>
          <p>No pages yet.</p>
        </div>
      </div>
    );
  }

  const page = gallery[currentPage];

  return (
    <div className="fullscreen-reader" ref={containerRef} onMouseDown={handleMouseDown}>
      <button className="reader-close" onClick={onClose} onMouseDown={(e) => e.stopPropagation()}>✕</button>

      <div
        className="reader-image-area"
        onDoubleClick={resetZoom}
        style={{ cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in' }}
      >
        <img
          key={currentPage}
          src={resolveAssetPath(page.src)}
          alt={page.alt || `Page ${currentPage + 1}`}
          className="reader-image"
          draggable={false}
          style={{
            transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
            transition: isPanning ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>

      {totalPages > 1 && (
        <div className="reader-nav">
          <button
            className="nav-button"
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage <= 0}
          >
            ‹
          </button>
          <span className="page-counter">{currentPage + 1} / {totalPages}</span>
          <button
            className="nav-button"
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
          >
            ›
          </button>
        </div>
      )}

      {zoom > 1 && (
        <button className="reader-reset-zoom" onClick={resetZoom} onMouseDown={(e) => e.stopPropagation()}>
          Reset zoom
        </button>
      )}
    </div>
  );
}
