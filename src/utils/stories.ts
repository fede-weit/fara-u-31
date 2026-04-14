import type { Story } from '../types';
import { MARKER_COLORS } from '../config/globe';

const storyColorMap = new Map<string, string>();

export function assignMarkerColors(stories: Story[]): Story[] {
  storyColorMap.clear();

  return stories.map((story, index) => {
    const color = MARKER_COLORS[index % MARKER_COLORS.length];
    story.markerColor = color;

    if (story.location) {
      story.location.markerColor = color;
    }

    storyColorMap.set(story.id, color);
    return story;
  });
}

export function getStoryColor(storyId: string | undefined): string | null {
  if (!storyId) return null;
  return storyColorMap.get(storyId) || MARKER_COLORS[0] || null;
}

function distributeFallback(index: number, total: number) {
  const angle = (index / total) * 360;
  const latitude = Math.sin((index / total) * Math.PI) * 50 - 25;
  return { latitude, longitude: angle - 180 };
}

import { findNearestLand, isLand } from './terrain';

export function enrichStories(stories: Story[]): Story[] {
  return stories.slice(0, 10).map((story, index, array) => {
    if (!story.location) {
      const fallback = distributeFallback(index, array.length || 1);
      story.location = {
        name: story.title,
        latitude: fallback.latitude,
        longitude: fallback.longitude,
      };
    }

    // Ensure locations are on land. If a location falls in water, snap it
    // to the nearest land using our terrain generator.
    if (story.location) {
      const { latitude, longitude } = story.location;
      if (!isLand(latitude, longitude)) {
        const newLoc = findNearestLand(latitude, longitude);
        // annotate that we snapped it
        (story.location as any).originalLatitude = latitude;
        (story.location as any).originalLongitude = longitude;
        story.location.latitude = newLoc.latitude;
        story.location.longitude = newLoc.longitude;
        (story.location as any).snappedToLand = true;
        // Log for debugging so dev can see which stories were moved
        try {
          // eslint-disable-next-line no-console
          console.debug(`story ${story.id} snapped to land: ${newLoc.latitude.toFixed(2)}, ${newLoc.longitude.toFixed(2)}`);
        } catch (e) {
          // ignore
        }
      }
    }

    return story;
  });
}

export async function loadStories(): Promise<Story[]> {
  try {
    const response = await fetch('/stories.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Impossibile caricare stories.json', error);
    return [];
  }
}

