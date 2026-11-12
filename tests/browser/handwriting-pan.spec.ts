import { test, expect, type Page, type Locator } from "@playwright/test";

async function openDrawing(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Add the next moment" }).click();
  const openInspector = page.getByRole("button", {
    name: "Open inspector",
    exact: true,
  });
  if (await openInspector.isVisible()) await openInspector.click();
  await page
    .getByRole("combobox", { name: "Node type", exact: true })
    .selectOption("handwritten");
  const editor = page.getByRole("region", {
    name: "Hand written page",
    exact: true,
  });
  const surface = editor.getByRole("img", {
    name: "Hand written drawing canvas",
  });
  await expect(
    editor.getByRole("button", { name: "Done", exact: true }),
  ).toBeEnabled();
  await editor
    .getByRole("button", { name: "Full screen writing page (90% width)" })
    .click();
  const rect = (await surface.boundingBox())!;
  await page.mouse.move(rect.x + rect.width - 75, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width - 30,
    rect.y + rect.height / 2 + 25,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(surface.locator("polyline")).toHaveCount(1);
  await expect(
    editor.getByRole("button", { name: "Done", exact: true }),
  ).toBeEnabled();
  await editor
    .getByRole("button", { name: "Restore half-screen writing page" })
    .click();
  return { editor, surface };
}

async function xOffset(surface: Locator) {
  return surface.evaluate((el: SVGSVGElement) => el.viewBox.baseVal.x);
}

test("desktop panning reveals overflow without changing ink, and drawing/erasing use the panned coordinates", async ({
  page,
}) => {
  const { editor, surface } = await openDrawing(page);
  const original = await surface.locator("polyline").getAttribute("points");
  const position = editor.getByRole("slider", {
    name: "Drawing horizontal position",
  });
  await expect(position).toBeVisible();
  const rect = (await surface.boundingBox())!;
  await surface.focus();
  await page.mouse.move(rect.x + rect.width * 0.75, rect.y + 100);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.4, rect.y + 100, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  expect(await xOffset(surface)).toBeGreaterThan(0);
  await surface.press("Home");
  await page.mouse.move(rect.x + rect.width * 0.75, rect.y + 100);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(rect.x + rect.width * 0.4, rect.y + 100, { steps: 8 });
  await page.mouse.up({ button: "middle" });
  expect(await xOffset(surface)).toBeGreaterThan(0);
  await surface.press("Home");
  await page.mouse.wheel(250, 0);
  await expect.poll(() => xOffset(surface)).toBeGreaterThan(0);
  await editor
    .getByRole("button", { name: "Pan drawing", exact: true })
    .click();
  await page.mouse.move(rect.x + rect.width * 0.7, rect.y + 100);
  await page.mouse.down();
  await page.mouse.move(rect.x + 20, rect.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect(surface.locator("polyline")).toHaveCount(1);
  await expect(surface.locator("polyline")).toHaveAttribute(
    "points",
    original!,
  );
  await position.focus();
  await position.press("End");
  const offset = await xOffset(surface);
  expect(offset).toBeGreaterThan(0);
  const mark = (await surface.locator("polyline").boundingBox())!;
  expect(mark.x).toBeGreaterThanOrEqual(rect.x);
  expect(mark.x + mark.width).toBeLessThanOrEqual(rect.x + rect.width + 1);
  await editor.getByRole("button", { name: "Pen", exact: true }).click();
  await page.mouse.move(rect.x + 50, rect.y + 80);
  await page.mouse.down();
  await page.mouse.move(rect.x + 90, rect.y + 90, { steps: 5 });
  await page.mouse.up();
  await expect(surface.locator("polyline")).toHaveCount(2);
  const point = (await surface
    .locator("polyline")
    .nth(1)
    .getAttribute("points"))!
    .split(" ")[0]
    .split(",")
    .map(Number);
  expect(point[0]).toBeGreaterThan(offset);
  await expect(
    editor.getByRole("button", { name: "Done", exact: true }),
  ).toBeEnabled();
  await editor.getByRole("button", { name: "Erase stroke" }).click();
  await page.mouse.click(rect.x + 50, rect.y + 80);
  await expect(surface.locator("polyline")).toHaveCount(1);
  await editor
    .getByRole("button", { name: "Full screen writing page (90% width)" })
    .click();
  expect(await xOffset(surface)).toBe(0);
  await expect(surface.locator("polyline")).toHaveAttribute(
    "points",
    original!,
  );
  await editor.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Open writing page", exact: true })
    .click();
  await expect(surface.locator("polyline")).toHaveAttribute(
    "points",
    original!,
  );
});

test.describe("phone touch drawing", () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [430, 932],
  ]) {
    test(`web drawing supports touch panning and fits ${width}×${height}`, async ({
      page,
    }) => {
      const { editor, surface } = await openDrawing(page);
      await editor.getByRole("button", { name: "Done", exact: true }).click();
      await page.setViewportSize({ width, height });
      await page
        .getByRole("button", { name: "Open writing page", exact: true })
        .tap();
      await expect(
        editor.getByRole("button", {
          name: "Full screen writing page (90% width)",
        }),
      ).toBeHidden();
      await expect(
        editor.getByRole("button", { name: /Move writing page to/ }),
      ).toBeHidden();
      const expanded = (await editor.boundingBox())!;
      expect(expanded.width).toBeCloseTo(width * 0.9, 0);
      expect(expanded.x).toBeCloseTo(width * 0.05, 0);
      const before = await surface.locator("polyline").getAttribute("points");
      const rect = (await surface.boundingBox())!;
      expect(rect.height).toBeGreaterThan(100);
      const cdp = await page.context().newCDPSession(page);
      const drag = async (fingers: number) => {
        const points = Array.from({ length: fingers }, (_, i) => ({
          id: i + 1,
          x: rect.x + rect.width - 25,
          y: rect.y + 50 + i * 45,
        }));
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: points,
        });
        for (let step = 1; step <= 6; step++) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: points.map((p) => ({
              ...p,
              x: p.x - ((rect.width - 50) * step) / 6,
            })),
          });
        }
        // Let the emulated finger settle before lifting so Chromium does not interpret the drag as a fling.
        await new Promise((resolve) => setTimeout(resolve, 180));
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      };
      await drag(2);
      expect(await xOffset(surface)).toBeGreaterThan(0);
      await expect(surface.locator("polyline")).toHaveCount(1);
      await expect(surface.locator("polyline")).toHaveAttribute(
        "points",
        before!,
      );
      const slider = editor.getByRole("slider", {
        name: "Drawing horizontal position",
      });
      await slider.focus();
      await slider.press("Home");
      await editor
        .getByRole("button", { name: "Pan drawing", exact: true })
        .tap();
      await drag(1);
      expect(await xOffset(surface)).toBeGreaterThan(0);
      await expect(surface.locator("polyline")).toHaveCount(1);
      const pen = editor.getByRole("button", { name: "Pen", exact: true });
      await pen.tap();
      await expect(pen).toHaveAttribute("aria-pressed", "true");
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ id: 1, x: rect.x + 30, y: rect.y + 40 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: [],
      });
      await expect(surface.locator("polyline")).toHaveCount(1);
      await expect(surface.locator("circle")).toHaveCount(0);
      await drag(1);
      await expect(surface.locator("polyline")).toHaveCount(2);
      await expect(
        editor.getByRole("button", { name: "Undo drawing" }),
      ).toBeEnabled();
      await editor.getByRole("button", { name: "Undo drawing" }).tap();
      await expect(surface.locator("polyline")).toHaveCount(1);
      for (const selector of [
        "html",
        ".handwriting-editor",
        ".handwriting-heading",
        ".ink-pan-navigation",
      ]) {
        expect(
          await page
            .locator(selector)
            .evaluateAll((els) =>
              els.every((el) => el.scrollWidth <= el.clientWidth + 1),
            ),
          selector,
        ).toBe(true);
      }
      await expect(
        editor.getByRole("button", { name: "Done", exact: true }),
      ).toBeInViewport();
      await slider.press("End");
      const rightmostMark = (await surface.locator("polyline").boundingBox())!;
      expect(rightmostMark.x).toBeGreaterThanOrEqual(rect.x);
      expect(rightmostMark.x + rightmostMark.width).toBeLessThanOrEqual(
        rect.x + rect.width + 1,
      );
      await editor
        .locator(".ink-tools")
        .evaluate((tools) => tools.scrollTo({ left: 0 }));
      await page.screenshot({
        path: `test-results/handwriting-phone-${width}.png`,
      });
      await expect(surface.locator("polyline")).toHaveAttribute(
        "points",
        before!,
      );
      if (width === 390) {
        await page.setViewportSize({ width: height, height: width });
        expect((await editor.boundingBox())!.width).toBeCloseTo(
          height * 0.9,
          0,
        );
        expect((await surface.boundingBox())!.height).toBeGreaterThan(100);
        await expect(
          editor.getByRole("button", { name: "Done", exact: true }),
        ).toBeInViewport();
        await expect(surface.locator("polyline")).toHaveAttribute(
          "points",
          before!,
        );
        await page.screenshot({
          path: "test-results/handwriting-phone-landscape.png",
        });
        await page.setViewportSize({ width, height });
      }
      await editor.getByRole("button", { name: "Done", exact: true }).tap();
      await page.screenshot({ path: `test-results/web-phone-${width}.png` });
      await cdp.detach();
    });
  }
});

async function annotationToolbar(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Hand annotation", exact: true })
    .click();
  const bar = page.getByRole("region", { name: "Hand annotation toolbar" });
  const handle = bar.getByRole("button", {
    name: "Move hand annotation toolbar",
  });
  await expect(bar).toBeVisible();
  const checkBounds = async () => {
    const view = (await page.locator(".canvas-scroll").boundingBox())!;
    const box = (await bar.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(view.x - 1);
    expect(box.y).toBeGreaterThanOrEqual(view.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(view.x + view.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(view.y + view.height + 1);
    return box;
  };
  return { bar, handle, checkBounds };
}

test("annotation toolbar stays in the work area after mouse drag, zoom, and resize", async ({
  page,
}) => {
  const { bar, handle, checkBounds } = await annotationToolbar(page);
  const before = await checkBounds();
  const grip = (await handle.boundingBox())!;
  await page.mouse.move(grip.x + 25, grip.y + 20);
  await page.mouse.down();
  await page.mouse.move(1439, 959, { steps: 12 });
  await page.mouse.up();
  const moved = await checkBounds();
  expect(moved.x).toBeGreaterThan(before.x);
  expect(moved.y).toBeGreaterThan(before.y);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(async () => (await bar.boundingBox())!.y).toBe(moved.y);
  await page.setViewportSize({ width: 390, height: 650 });
  await expect
    .poll(async () => (await bar.boundingBox())!.y)
    .toBeLessThan(moved.y);
  await checkBounds();
  await handle.press("Home");
  expect((await checkBounds()).y).toBeLessThan(moved.y);
  await bar.getByRole("button", { name: "Done annotating" }).click();
  await expect(bar).toHaveCount(0);
});

test.describe("annotation toolbar on touch screens", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  test("a finger can drag the annotation tools without making marks", async ({
    page,
  }) => {
    const { bar, handle, checkBounds } = await annotationToolbar(page);
    const before = await checkBounds();
    const grip = (await handle.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const start = { id: 1, x: grip.x + 28, y: grip.y + 22 };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [start],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...start, y: 820 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect((await checkBounds()).y).toBeGreaterThan(before.y);
    await expect(
      page
        .getByRole("img", { name: "Hand annotation layer" })
        .locator("circle,polyline"),
    ).toHaveCount(0);
    await bar.getByRole("button", { name: "Done annotating" }).click();
    await expect(bar).toHaveCount(0);
    await cdp.detach();
  });
});
