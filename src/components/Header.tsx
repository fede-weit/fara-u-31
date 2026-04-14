import { useState, useRef, useEffect } from 'react';
import type { Theme, Story } from '../types';
import { getStoryColor } from '../utils/stories';
import './Header.css';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  audioEnabled: boolean;
  isAudioPlaying: boolean;
  onToggleAudio: () => void;
  stories?: Story[];
  selectedId?: string | null;
  onSelectStory?: (story: Story) => void;
  onOpenStory?: (story: Story) => void;
}

export function Header({
  onToggleTheme,
  audioEnabled,
  isAudioPlaying,
  onToggleAudio,
  stories = [],
  selectedId,
  onSelectStory,
  onOpenStory,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleSelectStory = (story: Story) => {
    onSelectStory?.(story);
    setMenuOpen(false);
  };

  const handleOpenStory = (story: Story) => {
    onOpenStory?.(story);
    setMenuOpen(false);
  };

  return (
    <header className="site-header">
      <div className="branding">
        <span className="world-label">Universo condiviso</span>
        <h1>Relata Tales</h1>
        <p className="tagline">Esplora otto storie in un unico pianeta narrativo</p>
      </div>
      
      <div className="header-actions">
        {/* Stories dropdown menu */}
        {stories.length > 0 && (
          <div className="stories-menu" ref={menuRef}>
            <button 
              className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              <span className="menu-icon">☰</span>
              <span className="menu-label">Storie</span>
            </button>
            
            {menuOpen && (
              <div className="menu-dropdown">
                <div className="menu-header">
                  <span>Scegli una storia</span>
                  <small>Clic per selezionare, doppio clic per aprire</small>
                </div>
                <ul className="menu-list">
                  {stories.map((story) => {
                    const accentColor = story.markerColor || getStoryColor(story.id);
                    const isSelected = story.id === selectedId;

                    return (
                      <li key={story.id}>
                        <button
                          className={`menu-item ${isSelected ? 'is-selected' : ''}`}
                          style={{ '--story-accent': accentColor } as React.CSSProperties}
                          onClick={() => handleSelectStory(story)}
                          onDoubleClick={() => handleOpenStory(story)}
                        >
                          <span
                            className="menu-item-dot"
                            style={{ background: accentColor ?? undefined }}
                          />
                          <span className="menu-item-name">
                            {story.location?.name ?? story.title}
                          </span>
                          {story.era && (
                            <span className="menu-item-era">{story.era}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label="Cambia tema"
        >
          Tema
        </button>
        
        <button
          type="button"
          className="audio-toggle"
          onClick={onToggleAudio}
          aria-pressed={!isAudioPlaying}
          disabled={!audioEnabled}
        >
          {isAudioPlaying ? '🔊' : '🔇'}
        </button>
      </div>
    </header>
  );
}
