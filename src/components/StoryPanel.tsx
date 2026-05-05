import { Link } from 'react-router-dom';
import type { Story } from '../types';
import { getStoryColor } from '../utils/stories';

interface StoryPanelProps {
  story: Story | null;
}

export function StoryPanel({ story }: StoryPanelProps) {
  const accentColor = story ? (story.markerColor || getStoryColor(story.id)) : undefined;

  if (!story) {
    return (
      <section className="story-panel" aria-live="polite">
        <div className="panel-header">
          <p className="panel-era"></p>
          <h2 className="panel-title">Choose a location on the globe</h2>
        </div>
        <p className="panel-tagline"></p>
        <p className="panel-summary"></p>
        <ul className="panel-themes"></ul>
        <div className="panel-actions">
          <span className="panel-link" aria-disabled="true">
            Open story
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="story-panel" aria-live="polite">
      <div className="panel-header">
        <p className="panel-era">{story.era ?? 'Unknown era'}</p>
        <h2 className="panel-title" style={{ color: accentColor ?? undefined }}>
          {story.title}
        </h2>
      </div>
      <p className="panel-tagline">{story.tagline}</p>
      <p className="panel-summary">{story.summary}</p>
      {story.themes && story.themes.length > 0 && (
        <ul className="panel-themes">
          {story.themes.map((theme, index) => (
            <li key={index}>{theme}</li>
          ))}
        </ul>
      )}
      <div className="panel-actions">
        {story.route ? (
          <Link
            to={`/story/${story.id}`}
            className="panel-link"
          >
            Open story
          </Link>
        ) : (
          <span className="panel-link" aria-disabled="true">
            Open story
          </span>
        )}
      </div>
    </section>
  );
}

