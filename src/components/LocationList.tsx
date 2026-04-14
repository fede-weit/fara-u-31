import type { Story } from '../types';
import { getStoryColor } from '../utils/stories';

interface LocationListProps {
  stories: Story[];
  selectedId: string | null;
  onSelect: (story: Story) => void;
  onOpen: (story: Story) => void;
}

export function LocationList({ stories, selectedId, onSelect, onOpen }: LocationListProps) {
  return (
    <div className="globe-nav" aria-label="Seleziona una location anche da tastiera">
      <ul className="location-list">
        {stories.map((story) => {
          const accentColor = story.markerColor || getStoryColor(story.id);
          const isSelected = story.id === selectedId;

          return (
            <li key={story.id}>
              <button
                type="button"
                className="location-button"
                aria-current={isSelected ? 'true' : 'false'}
                style={{ '--story-accent': accentColor } as React.CSSProperties}
                onClick={() => onSelect(story)}
                onDoubleClick={() => onOpen(story)}
                onFocus={() => onSelect(story)}
              >
                <span>{story.location?.name ?? story.title}</span>
                <span className="location-era">{story.era ?? 'Era'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

