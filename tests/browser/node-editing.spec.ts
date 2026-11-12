import { test, expect, type Page } from "@playwright/test";
import { newProject, newNode, textBlock } from "../../apps/web/src/domain";
import { createRequire } from "node:module";
const JSZip = createRequire(import.meta.url)("jszip");

async function openStory(page: Page, source: string) {
  const project = newProject("In-place editing");
  const node = newNode(
    project.chapters[0].id,
    "The train that was waiting beyond the station at the end of the valley",
    "The first block stays in place.\n\nSo does its second paragraph.",
  );
  node.blocks.push(textBlock(source));
  project.nodes.push(node);
  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(project));
  await page.goto("/");
  const home = page.getByRole("button", { name: "My projects", exact: true });
  if (await home.isVisible()) await home.click();
  else await page.locator("button.brand").click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "edit.storytracks",
      mimeType: "application/zip",
      buffer: await zip.generateAsync({ type: "nodebuffer" }),
    });
  await expect(page.locator(".node-card")).toHaveCount(1);
}

async function textPoint(page: Page, word: string, inside = 3) {
  const marker = page
    .locator(".prose [data-source-start]")
    .filter({ hasText: word })
    .first();
  await marker.scrollIntoViewIfNeeded();
  return marker.evaluate(
    (element, { word, inside }) => {
      const text = element.firstChild!;
      const offset = text.textContent!.indexOf(word) + inside;
      const range = document.createRange();
      range.setStart(text, offset);
      range.setEnd(text, offset + 1);
      const rect = range.getBoundingClientRect();
      return { x: rect.left + rect.width * 0.1, y: rect.top + rect.height / 2 };
    },
    { word, inside },
  );
}

for (const mode of [
  "canvas",
  "compact",
  "zoom",
  "phone-large-fonts",
] as const) {
  test(`double-click preserves card dimensions and the clicked block/caret in ${mode}`, async ({
    page,
  }) => {
    if (mode === "phone-large-fonts") {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.addInitScript(() =>
        localStorage.setItem(
          "storytracks-font-sizes",
          JSON.stringify({ titles: 48, subtitles: 32, main: 24, system: 20 }),
        ),
      );
    }
    const source =
      "A quiet platform.\n\nShe remembers the **stationmaster** and his promise. The journey begins here.";
    await openStory(page, source);
    if (mode === "compact")
      await page
        .getByRole("button", { name: "Compact view", exact: true })
        .click();
    if (mode === "zoom") {
      for (let i = 0; i < 5; i++)
        await page
          .getByRole("button", { name: "Zoom in", exact: true })
          .click();
    }
    const point = await textPoint(page, "stationmaster");
    const before = await page.locator(".node-card").boundingBox();
    const titleBefore = await page
      .locator(".node-title-button h2")
      .boundingBox();
    const blocksBefore = await page.locator(".prose").evaluateAll((elements) =>
      elements.map((e) => ({
        width: e.getBoundingClientRect().width,
        height: e.getBoundingClientRect().height,
      })),
    );
    const scrollBefore = await page
      .locator(".canvas-scroll")
      .evaluate((e) => e.scrollTop);
    await page.mouse.dblclick(point.x, point.y);
    const field = page.getByLabel("Content block 2", { exact: true });
    await expect(field).toBeFocused();
    const offset = source.indexOf("stationmaster") + 3;
    expect(
      await field.evaluate((e: HTMLTextAreaElement) => [
        e.selectionStart,
        e.selectionEnd,
      ]),
    ).toEqual([offset, offset]);
    const after = await page.locator(".node-card").boundingBox();
    expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(2);
    expect(
      Math.abs(
        (await page.getByLabel("Node title", { exact: true }).boundingBox())!
          .height - titleBefore!.height,
      ),
    ).toBeLessThanOrEqual(2);
    for (let i = 0; i < 2; i++) {
      const box = await page
        .getByLabel(`Content block ${i + 1}`, { exact: true })
        .boundingBox();
      expect(Math.abs(box!.width - blocksBefore[i].width)).toBeLessThanOrEqual(
        2,
      );
      expect(
        Math.abs(box!.height - blocksBefore[i].height),
      ).toBeLessThanOrEqual(2);
    }
    expect(
      await page.locator(".canvas-scroll").evaluate((e) => e.scrollTop),
    ).toBeCloseTo(scrollBefore, 0);
    await page.keyboard.insertText("X");
    await expect(field).toHaveValue(
      source.slice(0, offset) + "X" + source.slice(offset),
    );
    const doneBox = await page
      .getByRole("button", { name: "Done", exact: true })
      .boundingBox();
    const editedBox = await page.locator(".node-card").boundingBox();
    expect(doneBox!.y + doneBox!.height).toBeLessThanOrEqual(
      editedBox!.y + editedBox!.height + 1,
    );
    await page.screenshot({ path: `test-results/in-place-${mode}.png` });
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.locator(".prose").nth(1)).toContainText("staXtionmaster");
    await expect(page.locator(".save-status")).toHaveClass(/saved/);
    await page.reload();
    await expect(page.locator(".prose").nth(1)).toContainText("staXtionmaster");
  });
}

for (const [source, word, inside, expected] of [
  [
    "Visit [Bellwether](https://example.com) for the next train.",
    "Bellwether",
    4,
    "Bellwether",
  ],
  ["The name is caf&eacute; and the sign reads A &amp; B.", "café", 3, "caf"],
  ["Look at the escaped \\*asterisk and smile 😀 again.", "asterisk", 3, "ast"],
  ["An inline `station_code` marks the platform.", "station_code", 4, "stat"],
] as const) {
  test(`rendered Markdown maps to source: ${word}`, async ({ page }) => {
    await openStory(page, source);
    const point = await textPoint(page, word, inside);
    await page.mouse.dblclick(point.x, point.y);
    const field = page.getByLabel("Content block 2", { exact: true });
    await expect(field).toBeFocused();
    expect(
      await field.evaluate((e: HTMLTextAreaElement) => e.selectionStart),
    ).toBe(source.indexOf(expected) + inside);
  });
}
