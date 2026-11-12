import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const JSZip = createRequire(import.meta.url)("jszip");

async function draw(page: Page, surface: Locator) {
  const box = (await surface.boundingBox())!;
  const x = box.x + box.width * 0.35,
    y = box.y + Math.min(300, box.height * 0.35);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 80, y + 40, { steps: 12 });
  await page.mouse.move(x + 130, y - 20, { steps: 12 });
  await page.mouse.up();
}

test("hand written pages draw, swap sides, expand centered to 90%, reopen, and publish a PNG", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Hand written", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Add the next moment" }).click();
  await page
    .getByRole("combobox", { name: "Node type", exact: true })
    .selectOption("handwritten");
  const editor = page.getByRole("region", {
    name: "Hand written page",
    exact: true,
  });
  await expect(editor).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "Done", exact: true }),
  ).toBeEnabled();
  const initial = (await editor.boundingBox())!;
  expect(initial.width).toBeCloseTo(720, 0);
  expect(initial.height).toBeCloseTo(960, 0);
  expect(initial.x).toBe(0);
  await page.getByLabel("Hand written node title").fill("Hand drawn map");
  const surface = editor.getByRole("img", {
    name: "Hand written drawing canvas",
  });
  await draw(page, surface);
  await expect(surface.locator("polyline")).toHaveCount(1);
  await expect(
    editor.getByRole("button", { name: "Undo drawing" }),
  ).toBeEnabled();
  await editor.getByRole("button", { name: "Undo drawing" }).click();
  await expect(surface.locator("polyline")).toHaveCount(0);
  await expect(
    editor.getByRole("button", { name: "Redo drawing" }),
  ).toBeEnabled();
  await editor.getByRole("button", { name: "Redo drawing" }).click();
  await expect(surface.locator("polyline")).toHaveCount(1);
  await editor
    .getByRole("button", { name: "Move writing page to right" })
    .click();
  expect((await editor.boundingBox())!.x).toBeCloseTo(720, 0);
  await editor
    .getByRole("button", { name: "Full screen writing page (90% width)" })
    .click();
  const wide = (await editor.boundingBox())!;
  expect(wide.width).toBeCloseTo(1296, 0);
  expect(wide.x).toBeCloseTo(72, 0);
  await expect(
    editor.getByRole("button", { name: "Move writing page to left" }),
  ).toBeDisabled();
  expect(wide.height).toBe(initial.height);
  expect((await surface.boundingBox())!.width).toBeGreaterThan(initial.width);
  const paper = (await surface.boundingBox())!;
  await page.mouse.move(paper.x + paper.width - 100, paper.y + 150);
  await page.mouse.down();
  await page.mouse.move(paper.x + paper.width - 40, paper.y + 210, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(surface.locator("polyline")).toHaveCount(2);
  await page.screenshot({ path: "test-results/handwritten-wide.png" });
  await editor
    .getByRole("button", { name: "Restore half-screen writing page" })
    .click();
  expect((await editor.boundingBox())!.x).toBeCloseTo(720, 0);
  await page.screenshot({ path: "test-results/handwritten-half.png" });
  await expect(
    editor.getByRole("button", { name: "Done", exact: true }),
  ).toBeEnabled();
  await editor.getByRole("button", { name: "Done", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Open writing page", exact: true })
    .click();
  await expect(surface.locator("polyline")).toHaveCount(2);
  await expect(page.getByLabel("Hand written node title")).toHaveValue(
    "Hand drawn map",
  );
  await editor.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText("Preview the storytrack", { exact: true }).click();
  const image = page.locator(
    '.publication-formatted img[alt="Hand written page"]',
  );
  await expect(image).toBeVisible();
  expect(
    await image.evaluate((el: HTMLImageElement) => el.naturalWidth),
  ).toBeGreaterThanOrEqual(1000);
  expect(
    await image.evaluate(
      (el: HTMLImageElement) => el.naturalWidth > el.naturalHeight,
    ),
  ).toBe(true);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export storytrack" }).click(),
  ]);
  const zip = await JSZip.loadAsync(readFileSync((await download.path())!));
  const markdown = await zip
    .file(Object.keys(zip.files).find((name) => name.endsWith(".md"))!)!
    .async("string");
  const reference = markdown.match(
    /!\[Hand written page\]\((assets\/[^)]+\.png)\)/,
  )!;
  expect(reference).toBeTruthy();
  expect(
    (await zip.file(reference[1])!.async("uint8array")).length,
  ).toBeGreaterThan(1000);
});

test("private hand annotations persist, follow zoom, and can be hidden", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Hand annotation", exact: true })
    .click();
  const ink = page.getByRole("img", { name: "Hand annotation layer" });
  await draw(page, ink);
  await expect(ink.locator("polyline")).toHaveCount(1);
  await page.getByRole("button", { name: "Done annotating" }).click();
  const original = (await ink.locator("polyline").boundingBox())!;
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  expect((await ink.locator("polyline").boundingBox())!.width).toBeGreaterThan(
    original.width,
  );
  await expect(page.locator(".save-status")).toHaveClass(/saved/);
  await page.reload();
  await expect(ink.locator("polyline")).toHaveCount(1);
  await page.getByRole("button", { name: "Hide annotations" }).click();
  await expect(ink).toHaveCount(0);
  await page.getByRole("button", { name: "Show annotations" }).click();
  await expect(ink.locator("polyline")).toHaveCount(1);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText("Preview the storytrack", { exact: true }).click();
  await expect(page.locator(".publication-formatted img")).toHaveCount(0);
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await expect(page.getByLabel("Plain publication preview")).not.toContainText(
    "annotations",
  );
});

test("canvas sides start open, collapse independently, remember the view, and keep notes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1800, height: 960 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add sub-context", exact: true })
    .click();
  await page
    .getByLabel("Sub-context note 1", { exact: true })
    .fill("Keep this note when collapsed.");
  const story = page.locator(".story-canvas");
  const before = (await story.boundingBox())!.width;
  await page
    .getByRole("button", { name: "Collapse Sub-context", exact: true })
    .click();
  expect((await story.boundingBox())!.width).toBeGreaterThan(before);
  await expect(
    page.getByRole("button", { name: "Collapse Highlight", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Collapse Highlight", exact: true })
    .click();
  await page.screenshot({ path: "test-results/canvas-sides-collapsed.png" });
  await expect(page.locator(".save-status")).toHaveClass(/saved/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Expand Sub-context", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Expand Highlight", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Expand Sub-context", exact: true })
    .click();
  await expect(
    page.getByLabel("Sub-context note 1", { exact: true }),
  ).toHaveValue("Keep this note when collapsed.");
  await page
    .getByRole("button", { name: "Expand Highlight", exact: true })
    .click();
});
