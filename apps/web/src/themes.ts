export const themeStorageKey = "storytracks-theme";

// Reading surfaces retain contrast even in the more expressive themes.
const tokens = [
  "bg",
  "panel",
  "card",
  "raised",
  "input",
  "text",
  "muted",
  "soft",
  "line",
  "accent",
  "accent-dark",
  "on-accent",
  "danger",
  "danger-bg",
  "info",
  "warning",
  "violet",
] as const;

function palette(values: string[]) {
  if (values.length !== tokens.length)
    throw new Error("Incomplete theme palette");
  return Object.fromEntries(
    tokens.map((token, index) => [token, values[index]]),
  ) as Record<(typeof tokens)[number], string>;
}

export const themes = [
  {
    id: "neon",
    name: "Neon",
    description: "Electric blue, green, and pink",
    scheme: "dark",
    colors: palette([
      "#071017",
      "#0c1821",
      "#101f29",
      "#18323a",
      "#07131c",
      "#edf8fa",
      "#abc7d0",
      "#cee3e8",
      "#366574",
      "#65ff9a",
      "#143c2c",
      "#0b2c19",
      "#f3b1b1",
      "#493034",
      "#78caff",
      "#f3d68f",
      "#ff91bd",
    ]),
  },
  {
    id: "sunburst",
    name: "Sunburst",
    description: "Golden sunshine, vivid orange",
    scheme: "light",
    colors: palette([
      "#ffe6a3",
      "#fff0c4",
      "#fff9e6",
      "#ffdf94",
      "#fffbed",
      "#492b18",
      "#71492c",
      "#65391e",
      "#d69c35",
      "#90390f",
      "#ffdf91",
      "#fff8e9",
      "#963e32",
      "#f5dfd6",
      "#376277",
      "#795716",
      "#735177",
    ]),
  },
  {
    id: "coffee",
    name: "Coffee",
    description: "Roasted browns, soft caramel",
    scheme: "dark",
    colors: palette([
      "#191412",
      "#221b18",
      "#2b211c",
      "#382b24",
      "#1b1512",
      "#eee2da",
      "#c0a99a",
      "#d7c1b2",
      "#79604f",
      "#edba99",
      "#4a3024",
      "#2b1e17",
      "#efb3a3",
      "#493029",
      "#a4c9d0",
      "#dac28e",
      "#ceb7df",
    ]),
  },
  {
    id: "glass",
    name: "Glass",
    description: "Clear panes, polished reflections",
    scheme: "light",
    colors: palette([
      "#dae7ee",
      "#edf3f8",
      "#f6fafc",
      "#dce6ef",
      "#f8fcf9",
      "#1b3343",
      "#324a5c",
      "#2b4557",
      "#8fa9bf",
      "#224f6f",
      "#dce8f4",
      "#f4fcf7",
      "#963f45",
      "#f3dfe0",
      "#326879",
      "#75601d",
      "#735580",
    ]),
  },
  {
    id: "frost",
    name: "Frost",
    description: "Misty blue, crisp slate",
    scheme: "light",
    colors: palette([
      "#e5ebf1",
      "#eef2f6",
      "#f8fafc",
      "#dce5ef",
      "#fbfcfe",
      "#2d3c4e",
      "#53667b",
      "#40566e",
      "#92a5bb",
      "#3e628d",
      "#dae5f2",
      "#f8fbff",
      "#98434b",
      "#f3dfe3",
      "#326778",
      "#79601f",
      "#735580",
    ]),
  },
  {
    id: "morning",
    name: "Morning",
    description: "Linen and gentle sage",
    scheme: "light",
    colors: palette([
      "#e9ecdf",
      "#f1f3e9",
      "#f9faf3",
      "#e0e7d4",
      "#fcfdf7",
      "#343f32",
      "#5b6852",
      "#485b40",
      "#98a58a",
      "#4c6c39",
      "#dfe8cf",
      "#fbfff6",
      "#96433a",
      "#f1dfd6",
      "#3d6879",
      "#775c1d",
      "#765783",
    ]),
  },
  {
    id: "night",
    name: "Night",
    description: "Deep blue, quiet moonlight",
    scheme: "dark",
    colors: palette([
      "#151c28",
      "#1c2634",
      "#243143",
      "#304056",
      "#192332",
      "#e0e7f1",
      "#acbdd2",
      "#c7d4e5",
      "#526883",
      "#adc6ef",
      "#304665",
      "#192b45",
      "#edb1b7",
      "#46303d",
      "#a0cfdf",
      "#ddc994",
      "#c8b6e4",
    ]),
  },
  {
    id: "evening",
    name: "Evening",
    description: "Dusky plum, muted rose",
    scheme: "dark",
    colors: palette([
      "#231d29",
      "#2c2533",
      "#362d3e",
      "#47394f",
      "#292130",
      "#ece2eb",
      "#c8b3c8",
      "#ddcbdc",
      "#806783",
      "#e4b7cb",
      "#513a4c",
      "#322231",
      "#f0b5b0",
      "#50313c",
      "#accddd",
      "#ddc69a",
      "#cbb9ed",
    ]),
  },
] as const;

export type ThemeId = (typeof themes)[number]["id"];
export const defaultTheme: ThemeId = "coffee";
export function normalizeTheme(value: unknown): ThemeId {
  return themes.find((theme) => theme.id === value)?.id ?? defaultTheme;
}
export function loadTheme(): ThemeId {
  try {
    return normalizeTheme(localStorage.getItem(themeStorageKey));
  } catch {
    return defaultTheme;
  }
}
export function applyTheme(id: ThemeId) {
  const theme = themes.find((candidate) => candidate.id === id)!;
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.style.colorScheme = theme.scheme;
  for (const [token, value] of Object.entries(theme.colors))
    root.style.setProperty(`--${token}`, value);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme.colors.bg);
}
