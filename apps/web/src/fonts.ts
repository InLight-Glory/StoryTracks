export const defaultFont = "Verdana";
export const fontFamilyStorageKey = "storytracks-font-family";
export const commonFonts = [
  "Verdana",
  "Arial",
  "Calibri",
  "Cambria",
  "Candara",
  "Consolas",
  "Courier New",
  "Georgia",
  "Helvetica",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
];
export type FontPreferences = {
  current: string;
  default: string;
  recent: string[];
};
export function cleanFont(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const name = value.trim();
  if (!name || name.length > 200 || /[\x00-\x1f\x7f]/.test(name)) return;
  return name;
}
export function uniqueFonts(values: unknown[]): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const name = cleanFont(value);
    if (!name || seen.has(name.toLowerCase())) return [];
    seen.add(name.toLowerCase());
    return [name];
  });
}
export function normalizeFonts(value: unknown): FontPreferences {
  const saved =
    value && typeof value === "object"
      ? (value as Partial<FontPreferences>)
      : {};
  const preferred = cleanFont(saved.default) || defaultFont;
  return {
    current: cleanFont(saved.current) || preferred,
    default: preferred,
    recent: uniqueFonts(Array.isArray(saved.recent) ? saved.recent : []).slice(
      0,
      5,
    ),
  };
}
export function chooseFont(
  previous: FontPreferences,
  name: string,
): FontPreferences {
  const current = cleanFont(name);
  if (!current) return previous;
  return {
    ...previous,
    current,
    recent: uniqueFonts([current, ...previous.recent]).slice(0, 5),
  };
}
export function fontStack(name: string) {
  // Quote one family name, including names with punctuation, as a CSS string.
  const quoted = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${quoted}", Verdana, Arial, sans-serif`;
}
export async function systemFonts(): Promise<string[]> {
  if (window.__TAURI_INTERNALS__) {
    const { invoke } = await import("@tauri-apps/api/core");
    return uniqueFonts(await invoke<string[]>("list_system_fonts"));
  }
  const browser = window as Window & {
    queryLocalFonts?: () => Promise<{ family: string }[]>;
  };
  if (!browser.queryLocalFonts)
    throw new Error(
      "This browser cannot list installed fonts. Choose a common font or enter an installed font name below.",
    );
  try {
    return uniqueFonts(
      (await browser.queryLocalFonts()).map((font) => font.family),
    );
  } catch {
    throw new Error(
      "Font access was not granted. You can still choose a common font or enter an installed font name below.",
    );
  }
}
