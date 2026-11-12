import { expect, test } from "@playwright/test";

test("zoom fits all three canvas areas in a smaller window with both sidebars open", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1220, height: 820 });
  await page.goto("/");
  const viewport = page.locator(".canvas-scroll");
  const main = viewport.locator(".story-canvas");
  const context = viewport.getByRole("complementary", {
    name: "Sub-context canvas area",
  });
  const highlight = viewport.getByRole("complementary", {
    name: "Highlight canvas area",
  });
  const marker = main.locator(".track-marker").first();
  const markerAt100 = (await marker.boundingBox())!.height;
  await expect(page.locator(".outline-panel")).toBeVisible();
  await expect(page.locator(".inspector")).toBeVisible();
  expect((await context.boundingBox())!.y).toBeGreaterThan(
    (await main.boundingBox())!.y + 10,
  );
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  expect((await marker.boundingBox())!.height).toBeCloseTo(
    markerAt100 * 0.9,
    0,
  );
  await page
    .getByRole("button", { name: "Fit canvas width", exact: true })
    .click();
  const frame = (await viewport.boundingBox())!;
  const left = (await context.boundingBox())!;
  const center = (await main.boundingBox())!;
  const right = (await highlight.boundingBox())!;
  expect(left.y).toBeCloseTo(center.y, 0);
  expect(right.y).toBeCloseTo(center.y, 0);
  expect(left.x).toBeGreaterThanOrEqual(frame.x);
  expect(left.x + left.width).toBeLessThan(center.x);
  expect(center.x + center.width).toBeLessThan(right.x);
  expect(right.x + right.width).toBeLessThanOrEqual(frame.x + frame.width);
  await page.screenshot({ path: "test-results/canvas-fit-window.png" });
  const fittedZoom = parseInt(
    (await page.getByTitle("Reset zoom", { exact: true }).textContent())!,
    10,
  );
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  expect((await marker.boundingBox())!.height).toBeCloseTo(
    (markerAt100 * (fittedZoom + 10)) / 100,
    0,
  );
  await page.getByTitle("Reset zoom", { exact: true }).click();
  await expect(page.getByTitle("Reset zoom", { exact: true })).toHaveText(
    "100%",
  );
});

test("Compact view shows shorter previews and expands a selected node", async ({
  page,
}) => {
  await page.goto("/");
  const cards = page.locator(".story-canvas .node-card");
  const candidate = cards.nth(1);
  const before = (await candidate.boundingBox())!.height;
  const footer = candidate.locator(".node-footer");
  await expect(footer).toBeVisible();
  await page.getByRole("button", { name: "Compact view", exact: true }).click();
  await expect(candidate).toHaveClass(/compact-preview/);
  await expect(footer).toBeHidden();
  expect((await candidate.boundingBox())!.height).toBeLessThan(before * 0.75);
  await page.screenshot({ path: "test-results/canvas-compact.png" });
  await candidate.locator(".node-type").click();
  await expect(candidate).toHaveClass(/selected/);
  await expect(footer).toBeVisible();
  await expect(cards.first()).toHaveClass(/compact-preview/);
  await page.getByRole("button", { name: "Canvas view", exact: true }).click();
  await expect(page.locator(".compact-preview")).toHaveCount(0);
});
