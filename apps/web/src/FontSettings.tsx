import { useEffect, useLayoutEffect, useState } from "react";
import {
  chooseFont,
  commonFonts,
  defaultFont,
  fontFamilyStorageKey,
  fontStack,
  normalizeFonts,
  systemFonts,
  uniqueFonts,
} from "./fonts";

export const fontControls = [
  {
    key: "titles",
    label: "Titles",
    min: 24,
    max: 48,
    default: 32,
    hint: "Page and chapter headings",
  },
  {
    key: "subtitles",
    label: "Subtitles",
    min: 16,
    max: 32,
    default: 20,
    hint: "Node titles and section headings",
  },
  {
    key: "main",
    label: "Main text",
    min: 12,
    max: 24,
    default: 14,
    hint: "Story text, notes, and writing fields",
  },
  {
    key: "system",
    label: "System text",
    min: 12,
    max: 20,
    default: 13,
    hint: "Menus, buttons, labels, and other interface text",
  },
] as const;
type FontKey = (typeof fontControls)[number]["key"];
type FontSizes = Record<FontKey, number>;
const storageKey = "storytracks-font-sizes";
const defaults = Object.fromEntries(
  fontControls.map((c) => [c.key, c.default]),
) as FontSizes;

function bounded(key: FontKey, value: number) {
  const control = fontControls.find((c) => c.key === key)!;
  return Number.isFinite(value)
    ? Math.max(control.min, Math.min(control.max, Math.round(value)))
    : control.default;
}

function loadSizes(): FontSizes {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(storageKey) || "null",
    );
    if (!saved || typeof saved !== "object") return { ...defaults };
    return Object.fromEntries(
      fontControls.map(({ key }) => {
        const value = (saved as Record<string, unknown>)[key];
        return [
          key,
          typeof value === "number" ? bounded(key, value) : defaults[key],
        ];
      }),
    ) as FontSizes;
  } catch {
    return { ...defaults };
  }
}

export function useFontSettings() {
  const [sizes, setSizes] = useState(loadSizes);
  const [fonts, setFonts] = useState(() => {
    try {
      return normalizeFonts(
        JSON.parse(localStorage.getItem(fontFamilyStorageKey) || "null"),
      );
    } catch {
      return normalizeFonts(null);
    }
  });
  const [saved, setSaved] = useState(true);
  useLayoutEffect(() => {
    document.documentElement.style.setProperty(
      "--font-family",
      fontStack(fonts.current),
    );
    for (const { key } of fontControls)
      document.documentElement.style.setProperty(
        `--font-${key}`,
        `${sizes[key]}px`,
      );
    try {
      localStorage.setItem(storageKey, JSON.stringify(sizes));
      localStorage.setItem(fontFamilyStorageKey, JSON.stringify(fonts));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [sizes, fonts]);
  return {
    sizes,
    fonts,
    selectFont: (name: string) =>
      setFonts((previous) => chooseFont(previous, name)),
    makeDefault: () =>
      setFonts((previous) => ({ ...previous, default: previous.current })),
    restoreVerdana: () =>
      setFonts((previous) => ({
        ...chooseFont(previous, defaultFont),
        default: defaultFont,
      })),
    saved,
    update: (key: FontKey, value: number) =>
      setSizes((previous) => ({ ...previous, [key]: bounded(key, value) })),
    reset: () => setSizes({ ...defaults }),
  };
}

function SizeInput({
  control,
  value,
  onChange,
}: {
  control: (typeof fontControls)[number];
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const commit = () => {
    if (draft.trim() && Number.isFinite(Number(draft))) onChange(Number(draft));
    setEditing(false);
  };
  return (
    <input
      id={`font-${control.key}-number`}
      type="number"
      min={control.min}
      max={control.max}
      step={1}
      value={editing ? draft : value}
      aria-label={`${control.label} size in pixels`}
      aria-describedby={`font-${control.key}-hint`}
      onFocus={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const next = e.target.valueAsNumber;
        if (
          Number.isInteger(next) &&
          next >= control.min &&
          next <= control.max
        )
          onChange(next);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export default function FontSettings({
  settings,
}: {
  settings: ReturnType<typeof useFontSettings>;
}) {
  const [available, setAvailable] = useState<string[]>([]);
  const [fontName, setFontName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const loadFonts = async () => {
    setLoading(true);
    setMessage("");
    try {
      const fonts = await systemFonts();
      setAvailable(fonts);
      setMessage(`${fonts.length} installed font families available.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Installed fonts could not be loaded. Enter a font name below.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (window.__TAURI_INTERNALS__) void loadFonts();
  }, []);
  const options = uniqueFonts([
    settings.fonts.current,
    settings.fonts.default,
    ...available,
    ...commonFonts,
  ]).sort((a, b) => a.localeCompare(b));
  return (
    <section className="font-settings" aria-labelledby="font-settings-heading">
      <h3 id="font-settings-heading">Fonts</h3>
      <p>Changes appear immediately and are saved on this device.</p>
      <div className="font-setting font-family-setting">
        <label htmlFor="app-font">App font</label>
        <p>
          Applies to headings, story text, and menus. Default:{" "}
          {settings.fonts.default}.
        </p>
        <select
          id="app-font"
          value={settings.fonts.current}
          onChange={(event) => settings.selectFont(event.target.value)}
        >
          {options.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
        <button className="button" disabled={loading} onClick={loadFonts}>
          {loading ? "Loading fonts…" : "Load system fonts"}
        </button>
        {message && <p role="status">{message}</p>}
        <label htmlFor="custom-font">Installed font name</label>
        <div className="font-name-input">
          <input
            id="custom-font"
            value={fontName}
            onChange={(event) => setFontName(event.target.value)}
            maxLength={200}
            placeholder="Enter a font name"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                settings.selectFont(fontName);
              }
            }}
          />
          <button
            className="button"
            disabled={!fontName.trim()}
            onClick={() => settings.selectFont(fontName)}
          >
            Apply font
          </button>
        </div>
        <p>If a font is unavailable on this device, a fallback font is used.</p>
        {settings.fonts.recent.length > 0 && (
          <div className="recent-fonts" role="group" aria-label="Recent fonts">
            <span>Recent fonts</span>
            {settings.fonts.recent.map((font) => (
              <button
                key={font}
                className="button"
                aria-pressed={settings.fonts.current === font}
                onClick={() => settings.selectFont(font)}
              >
                {font}
              </button>
            ))}
          </div>
        )}
        <div className="font-default-actions">
          <button
            className="button"
            disabled={settings.fonts.current === settings.fonts.default}
            onClick={settings.makeDefault}
          >
            Make default
          </button>
          <button
            className="button"
            disabled={settings.fonts.current === settings.fonts.default}
            onClick={() => settings.selectFont(settings.fonts.default)}
          >
            Use default font
          </button>
          <button className="button" onClick={settings.restoreVerdana}>
            Restore Verdana default
          </button>
        </div>
      </div>
      <h4>Font sizes</h4>
      {fontControls.map((control) => (
        <div className="font-setting" key={control.key}>
          <label htmlFor={`font-${control.key}-range`}>{control.label}</label>
          <p id={`font-${control.key}-hint`}>
            {control.hint} · {control.min}–{control.max} px
          </p>
          <div className="font-setting-inputs">
            <input
              id={`font-${control.key}-range`}
              type="range"
              min={control.min}
              max={control.max}
              step={1}
              value={settings.sizes[control.key]}
              aria-describedby={`font-${control.key}-hint`}
              aria-valuetext={`${settings.sizes[control.key]} pixels`}
              onChange={(e) =>
                settings.update(control.key, e.target.valueAsNumber)
              }
            />
            <SizeInput
              control={control}
              value={settings.sizes[control.key]}
              onChange={(value) => settings.update(control.key, value)}
            />
            <span aria-hidden="true">px</span>
          </div>
        </div>
      ))}
      <div className="font-preview" aria-label="Font size preview">
        <div className="font-preview-title">Your story’s shape</div>
        <div className="font-preview-subtitle">A new chapter</div>
        <p>The next sentence is yours to write.</p>
        <small>Interface text preview</small>
      </div>
      {!settings.saved && (
        <p role="status">
          These font preferences apply for this session. Device storage is
          unavailable.
        </p>
      )}
      <div className="modal-footer">
        <button className="button" onClick={settings.reset}>
          Reset font sizes
        </button>
      </div>
    </section>
  );
}
