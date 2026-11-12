import test from "node:test";
import assert from "node:assert/strict";
import { themes, normalizeTheme } from "../apps/web/src/themes";

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
test("all theme text and action colors meet normal-text AA contrast", () => {
  for (const theme of themes) {
    for (const foreground of [
      "text",
      "muted",
      "soft",
      "accent",
      "info",
      "warning",
      "violet",
    ] as const) {
      for (const background of [
        "bg",
        "panel",
        "card",
        "raised",
        "input",
        "accent-dark",
      ] as const) {
        const ratio = contrast(
          theme.colors[foreground],
          theme.colors[background],
        );
        assert.ok(
          ratio >= 4.5,
          `${theme.name}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1`,
        );
      }
    }
    assert.ok(
      contrast(theme.colors["on-accent"], theme.colors.accent) >= 4.5,
      `${theme.name} action label`,
    );
    assert.ok(
      contrast(theme.colors.danger, theme.colors["danger-bg"]) >= 4.5,
      `${theme.name} error message`,
    );
  }
});
test("missing or damaged preferences fall back to Coffee", () => {
  for (const value of [null, undefined, "", "unknown", "NIGHT", {}, 42])
    assert.equal(normalizeTheme(value), "coffee");
  for (const theme of themes) assert.equal(normalizeTheme(theme.id), theme.id);
});

test("expressive theme backdrops and bright buttons retain readable text", () => {
  for (const [id, backgrounds] of [
    ["neon", ["#10283b", "#122630", "#0d2231", "#2b1823"]],
    ["sunburst", ["#ffc247", "#ffd35e", "#ffd2a0"]],
    ["glass", ["#c4e4ed", "#b4cfdf", "#a9c7d7"]],
  ] as const) {
    const theme = themes.find((theme) => theme.id === id)!;
    for (const background of backgrounds)
      for (const foreground of ["text", "muted", "soft", "accent"] as const)
        assert.ok(
          contrast(theme.colors[foreground], background) >= 4.5,
          `${id}: ${foreground} against decorative backdrop ${background}`,
        );
  }
  const sunburst = themes.find((theme) => theme.id === "sunburst")!;
  for (const background of ["#ffcf4c", "#ffa34c", "#ffdc72", "#ffb76d"])
    assert.ok(contrast(sunburst.colors.text, background) >= 4.5);
});
