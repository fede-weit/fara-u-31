import { useRef, useMemo, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import GlobeGL, { type GlobeMethods } from 'react-globe.gl';
import type { Story } from '../types';
import { MARKER_COLORS } from '../config/globe';
import { GLOBE_CUSTOM_BUMP_URL, GLOBE_CUSTOM_EQUIRECTANGULAR_URL } from '../config/globeAssets';
import { createProceduralGlobeTextureDataUrl } from '../utils/proceduralGlobeTexture';

interface GlobeProps {
  stories: Story[];
  selectedId: string | null;
  onSelect: (story: Story) => void;
  onOpen: (story: Story) => void;
}

interface GlobeExtraProps {
  resetViewKey?: number;
  /** When false, OrbitControls auto-rotate is off (user can still drag). Default true. */
  autoRotate?: boolean;
}

interface StoryPoint {
  lat: number;
  lng: number;
  color: string;
  story: Story;
}

const DOUBLE_CLICK_MS = 450;

export function Globe({
  stories,
  selectedId,
  onSelect,
  onOpen,
  resetViewKey,
  autoRotate = true,
}: GlobeProps & GlobeExtraProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ width: 600, height: 500 });

  const lastClickRef = useRef<{ storyId: string; t: number } | null>(null);

  const proceduralTextureUrl = useMemo(
    () => (GLOBE_CUSTOM_EQUIRECTANGULAR_URL ? '' : createProceduralGlobeTextureDataUrl()),
    []
  );

  const pointsData: StoryPoint[] = useMemo(() => {
    return stories
      .map((story, index) => {
        if (!story.location) return null;
        const color = story.markerColor ?? MARKER_COLORS[index % MARKER_COLORS.length];
        return {
          lat: story.location.latitude,
          lng: story.location.longitude,
          color,
          story,
        };
      })
      .filter((p): p is StoryPoint => p !== null);
  }, [stories]);

  const bumpUrl = GLOBE_CUSTOM_BUMP_URL ?? undefined;
  const globeImageUrl = GLOBE_CUSTOM_EQUIRECTANGULAR_URL ?? (proceduralTextureUrl || undefined);

  const setupControls = useCallback(() => {
    const ctrl = globeRef.current?.controls?.();
    if (!ctrl) return;
    ctrl.autoRotate = autoRotate;
    ctrl.autoRotateSpeed = 0.35;
    ctrl.enableZoom = false;
    ctrl.enablePan = false;
    ctrl.rotateSpeed = 0.5;
  }, [autoRotate]);

  useEffect(() => {
    const ctrl = globeRef.current?.controls?.();
    if (!ctrl) return;
    ctrl.autoRotate = autoRotate;
  }, [autoRotate]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const w = Math.max(1, el.clientWidth);
      const h = Math.max(1, el.clientHeight);
      setDims({ width: w, height: h });
    });

    ro.observe(el);
    setDims({
      width: Math.max(1, el.clientWidth),
      height: Math.max(1, el.clientHeight),
    });

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (resetViewKey === undefined) return;
    globeRef.current?.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 0);
    setupControls();
  }, [resetViewKey, setupControls]);

  const handlePointClick = useCallback(
    (point: object) => {
      const p = point as StoryPoint;
      const now = performance.now();
      const prev = lastClickRef.current;
      if (prev && prev.storyId === p.story.id && now - prev.t < DOUBLE_CLICK_MS) {
        lastClickRef.current = null;
        onOpen(p.story);
        return;
      }
      lastClickRef.current = { storyId: p.story.id, t: now };
      onSelect(p.story);
    },
    [onSelect, onOpen]
  );

  return (
    <div
      ref={containerRef}
      className="globe-interactive"
      style={{ width: '100%', height: '100%', minHeight: '500px', position: 'relative' }}
    >
      <GlobeGL
        ref={globeRef}
        width={dims.width}
        height={dims.height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={globeImageUrl}
        bumpImageUrl={bumpUrl}
        showGraticules={false}
        showAtmosphere
        atmosphereColor="rgba(120, 190, 255, 0.45)"
        atmosphereAltitude={0.18}
        globeCurvatureResolution={4}
        rendererConfig={{ antialias: true, alpha: true }}
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d: object) => (d as StoryPoint).color}
        pointAltitude={(d: object) => {
          const id = (d as StoryPoint).story.id;
          return id === selectedId ? 0.09 : 0.055;
        }}
        pointRadius={(d: object) => {
          const id = (d as StoryPoint).story.id;
          return id === selectedId ? 1.55 : 1.2;
        }}
        pointResolution={18}
        lineHoverPrecision={0.45}
        pointsMerge={false}
        pointsTransitionDuration={600}
        pointLabel={(d: object) => {
          const { story } = d as StoryPoint;
          const name = story.location?.name || story.title;
          const snapped = (story.location as { snappedToLand?: boolean })?.snappedToLand
            ? '<br/><small>spostato sulla terraferma</small>'
            : '';
          return `<div style="padding:6px 10px;background:rgba(20,20,30,.92);color:#fff;border-radius:8px;font:600 12px system-ui">${name}${snapped}</div>`;
        }}
        onPointClick={handlePointClick}
        onGlobeReady={setupControls}
      />
    </div>
  );
}
