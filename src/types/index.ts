export interface AudioSettings {
  loop: boolean;
  elementVolume: number;
  initialGain: number;
  fadeTargetGain: number;
  sustainGain: number;
  fadeDuration: number;
}

export interface Location {
  name: string;
  latitude: number;
  longitude: number;
  markerColor?: string;
}

export interface GalleryPage {
  src: string;
  alt: string;
  caption?: string;
}

export interface Story {
  id: string;
  title: string;
  tagline: string;
  summary: string;
  summaryLong?: string;
  era: string;
  themes: string[];
  cover: string;
  coverAlt: string;
  audio: string;
  audioLabel: string;
  audioSettings: AudioSettings;
  preferredTheme: 'dark' | 'light';
  gallery: GalleryPage[];
  route: string;
  location: Location;
  markerColor?: string;
}

export interface ProjectedLocation {
  x: number;
  y: number;
  radius: number;
  visible: boolean;
  depth: number;
  data: LocationWithStory;
}

export interface LocationWithStory extends Location {
  story: Story;
}

export type Theme = 'dark' | 'light';
export type ReadingMode = 'vertical' | 'horizontal';
export type ViewportMode = 'web' | 'mobile';

