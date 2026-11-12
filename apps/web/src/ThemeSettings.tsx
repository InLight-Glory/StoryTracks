import { useState } from "react";
import {
  applyTheme,
  loadTheme,
  themes,
  themeStorageKey,
  type ThemeId,
} from "./themes";

export function useThemeSettings() {
  const [current, setCurrent] = useState(loadTheme);
  const [saved, setSaved] = useState(true);
  const select = (id: ThemeId) => {
    applyTheme(id);
    setCurrent(id);
    try {
      localStorage.setItem(themeStorageKey, id);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  };
  return { current, saved, select };
}

export default function ThemeSettings({
  settings,
}: {
  settings: ReturnType<typeof useThemeSettings>;
}) {
  return (
    <section
      className="theme-settings"
      aria-labelledby="theme-settings-heading"
    >
      <h3 id="theme-settings-heading">Theme</h3>
      <p>
        Choose a comfortable palette. StoryTracks reopens with your last used
        theme on this device.
      </p>
      <div className="theme-grid" role="group" aria-label="Color themes">
        {themes.map((theme) => (
          <button
            key={theme.id}
            className="theme-choice"
            aria-label={theme.name}
            aria-pressed={settings.current === theme.id}
            onClick={() => settings.select(theme.id)}
          >
            <span
              className="theme-swatch"
              data-theme-preview={theme.id}
              aria-hidden="true"
              style={{
                background: theme.colors.bg,
                borderColor: theme.colors.line,
              }}
            >
              <span style={{ background: theme.colors.panel }} />
              <span
                style={{
                  background: theme.colors.card,
                  color: theme.colors.text,
                }}
              >
                Aa
              </span>
              <span style={{ background: theme.colors.accent }} />
            </span>
            <span className="theme-choice-name">
              {theme.name}
              <span aria-hidden="true">
                {settings.current === theme.id ? "✓" : ""}
              </span>
            </span>
            <small>{theme.description}</small>
          </button>
        ))}
      </div>
      {!settings.saved && (
        <p role="status">
          This theme applies for this session. Device storage is unavailable, so
          it cannot be remembered after closing.
        </p>
      )}
    </section>
  );
}
