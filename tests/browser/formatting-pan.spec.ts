import { test, expect, type Page } from "@playwright/test";

async function selectText(page: Page, start: number, end: number) {
  const field = page.getByLabel("Content block 1", { exact: true });
  await field.focus();
  await field.evaluate(
    (element: HTMLTextAreaElement, { start, end }) =>
      element.setSelectionRange(start, end),
    { start, end },
  );
  return field;
}

test("selection toolbar formats text, toggles styles, saves, and renders in publication", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".node-title-button").first().click();
  const field = page.getByLabel("Content block 1", { exact: true });
  await field.fill("A quiet station.");
  const toolbar = page.getByRole("toolbar", { name: "Text formatting" });
  await expect(toolbar).toHaveCount(0);
  await selectText(page, 2, 7);
  await expect(toolbar).toBeVisible();
  await page.screenshot({ path: "test-results/selection-formatting.png" });
  await toolbar.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(field).toHaveValue("A **quiet** station.");
  await toolbar.getByRole("button", { name: "Underline", exact: true }).click();
  await expect(field).toHaveValue("A **<u>quiet</u>** station.");
  await field.press("Control+i");
  await expect(field).toHaveValue("A **<u>*quiet*</u>** station.");
  await toolbar
    .getByRole("button", { name: "Strikethrough", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".prose strong u em del").first()).toHaveText(
    "quiet",
  );
  await expect(toolbar).toHaveCount(0);
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".prose strong u em del").first()).toHaveText(
    "quiet",
  );
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText("Preview the storytrack", { exact: true }).click();
  await expect(
    page.locator(".publication-formatted strong u em del").first(),
  ).toHaveText("quiet");
});

test("selecting rendered story text offers formatting without entering edit mode", async ({
  page,
}) => {
  await page.goto("/");
  const text = page.locator(".prose p [data-source-start]").first();
  const selected = (await text.textContent())!.slice(0, 5);
  await text.evaluate((element) => {
    const range = document.createRange();
    range.setStart(element.firstChild!, 0);
    range.setEnd(element.firstChild!, 5);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page
    .getByRole("toolbar", { name: "Text formatting" })
    .getByRole("button", { name: "Underline", exact: true })
    .click();
  await expect(page.locator(".prose u").first()).toHaveText(selected);
  await expect(page.locator(".node-edit")).toHaveCount(0);
});

test("formatting controls fit a phone and hide when the text selection is cleared", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await page.locator(".node-title-button").first().click();
  const field = page.getByLabel("Content block 1", { exact: true });
  await field.fill("Selected writing");
  await selectText(page, 0, 8);
  const toolbar = page.getByRole("toolbar", { name: "Text formatting" });
  await expect(toolbar).toBeInViewport();
  await expect(toolbar.getByRole("button", { name: "Quote", exact: true })).toBeInViewport();
  await page.screenshot({ path: "test-results/selection-formatting-phone.png" });
  await toolbar.getByRole("button", { name: "Italic", exact: true }).click();
  await expect(field).toHaveValue("*Selected* writing");
  await field.press("ArrowRight");
  await expect(toolbar).toHaveCount(0);
});

test("space-drag pans both axes at normal and reduced zoom and resets cleanly", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".canvas-board")).toBeVisible();
  for (const zoomed of [false, true]) {
    if (zoomed) {
      for (let i = 0; i < 3; i++)
        await page
          .getByRole("button", { name: "Zoom out", exact: true })
          .click();
    }
    await page.locator("body").click({ position: { x: 2, y: 2 } });
    const viewport = await page.locator(".canvas-scroll").boundingBox();
    const before = await page.locator(".canvas-board").boundingBox();
    const x = viewport!.x + viewport!.width / 2;
    const y = viewport!.y + 120;
    await page.keyboard.down("Space");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y + 70, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    const after = await page.locator(".canvas-board").boundingBox();
    expect(after!.x - before!.x).toBeCloseTo(100, 0);
    expect(after!.y - before!.y).toBeCloseTo(70, 0);
    await page.keyboard.down("Space");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 140, y - 90, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    const reverse = await page.locator(".canvas-board").boundingBox();
    expect(reverse!.x - after!.x).toBeCloseTo(-140, 0);
    expect(reverse!.y - after!.y).toBeCloseTo(-90, 0);
    await page.getByRole("button", { name: "Reset canvas position" }).click();
    await expect(page.locator(".canvas-pan-surface")).toHaveCSS("left", "0px");
    await expect(page.locator(".canvas-pan-surface")).toHaveCSS("top", "0px");
  }
  await page.locator(".node-title-button").first().click();
  const field = page.getByLabel("Content block 1", { exact: true });
  await field.fill("Typing");
  await field.press("End");
  await field.press("Space");
  await expect(field).toHaveValue("Typing ");
  await expect(page.locator(".canvas-scroll")).not.toHaveClass(/pan-ready/);
});
