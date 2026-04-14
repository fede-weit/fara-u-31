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
          <h2 className="panel-title">Scegli una location sul globo</h2>
        </div>
        <p className="panel-tagline"></p>
        <p className="panel-summary"></p>
        <ul className="panel-themes"></ul>
        <div className="panel-actions">
          <span className="panel-link" aria-disabled="true">
            Apri la storia
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="story-panel" aria-live="polite">
      <div className="panel-header">
        <p className="panel-era">{story.era ?? 'Era sconosciuta'}</p>
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
            Apri la storia
          </Link>
        ) : (
          <span className="panel-link" aria-disabled="true">
            Apri la storia
          </span>
        )}
      </div>
    </section>
  );
}

