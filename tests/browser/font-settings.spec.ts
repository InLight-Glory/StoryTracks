import { test, expect, type Page } from "@playwright/test";
import { fontControls } from "../../apps/web/src/FontSettings";

async function settings(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  return page.getByRole("dialog");
}
async function closeSettings(page: Page) {
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
}

test("font families default to Verdana, keep five recent choices, and save a custom default", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".node-body p").first()).toHaveCSS(
    "font-family",
    /Verdana/,
  );
  await expect(page.locator(".chapter-intro h1")).toHaveCSS(
    "font-family",
    /Verdana/,
  );
  await settings(page);
  const picker = page.getByLabel("App font", { exact: true });
  await expect(picker).toHaveValue("Verdana");
  for (const font of [
    "Arial",
    "Georgia",
    "Tahoma",
    "Consolas",
    "Cambria",
    "Calibri",
  ])
    await picker.selectOption(font);
  const recent = page.getByRole("group", { name: "Recent fonts" });
  await expect(recent.getByRole("button")).toHaveText([
    "Calibri",
    "Cambria",
    "Consolas",
    "Tahoma",
    "Georgia",
  ]);
  await recent.getByRole("button", { name: "Georgia", exact: true }).click();
  await page.getByRole("button", { name: "Make default", exact: true }).click();
  await picker.selectOption("Arial");
  await page
    .getByRole("button", { name: "Use default font", exact: true })
    .click();
  await expect(picker).toHaveValue("Georgia");
  await page.reload();
  await expect(page.locator(".node-body p").first()).toHaveCSS(
    "font-family",
    /Georgia/,
  );
  await settings(page);
  await expect(picker).toHaveValue("Georgia");
  await expect(recent.getByRole("button")).toHaveCount(5);
  await page.getByRole("button", { name: "Restore Verdana default" }).click();
  await expect(picker).toHaveValue("Verdana");
});

test("installed font loading deduplicates families and handles unavailable permissions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "queryLocalFonts", {
      configurable: true,
      value: async () => [
        { family: "Example Local Font" },
        { family: "Example Local Font" },
        { family: "Verdana" },
      ],
    });
  });
  await page.goto("/");
  await settings(page);
  await page.getByRole("button", { name: "Load system fonts" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "2 installed font families",
  );
  await page
    .getByLabel("App font", { exact: true })
    .selectOption("Example Local Font");
  await page.evaluate(() =>
    Object.defineProperty(window, "queryLocalFonts", {
      value: async () => {
        throw new Error("Denied");
      },
    }),
  );
  await page.getByRole("button", { name: "Load system fonts" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Font access was not granted",
  );
  await page
    .getByLabel("Installed font name", { exact: true })
    .fill("Courier New");
  await page.getByRole("button", { name: "Apply font" }).click();
  await expect(page.getByLabel("App font", { exact: true })).toHaveValue(
    "Courier New",
  );
});
async function fits(page: Page, selectors: string[]) {
  const overflow = await page.evaluate(
    (selectors) =>
      selectors.flatMap((selector) =>
        Array.from(document.querySelectorAll<HTMLElement>(selector))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return (
              rect.width &&
              rect.height &&
              element.scrollWidth > element.clientWidth + 2
            );
          })
          .map(
            (element) =>
              `${selector}: ${element.scrollWidth} > ${element.clientWidth}`,
          ),
      ),
    selectors,
  );
  expect(overflow).toEqual([]);
}

test("font controls apply independently, accept typed values, clamp bounds, persist, and reset", async ({
  page,
}) => {
  await page.goto("/");
  const originalText = await page.locator(".node-body p").first().textContent();
  await page.getByRole("button", { name: "Settings", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
  for (const control of fontControls) {
    const slider = page.getByRole("slider", {
      name: control.label,
      exact: true,
    });
    await slider.focus();
    await page.keyboard.press("End");
    await expect(
      page.getByRole("spinbutton", {
        name: `${control.label} size in pixels`,
        exact: true,
      }),
    ).toHaveValue(String(control.max));
    await expect(page.locator("html")).toHaveCSS(
      `--font-${control.key}`,
      `${control.max}px`,
    );
    await slider.press("Home");
    await expect(slider).toHaveValue(String(control.min));
  }
  const titleInput = page.getByRole("spinbutton", {
    name: "Titles size in pixels",
    exact: true,
  });
  await titleInput.fill("999");
  await titleInput.press("Enter");
  await expect(titleInput).toHaveValue("48");
  await titleInput.fill("1");
  await titleInput.press("Tab");
  await expect(titleInput).toHaveValue("24");
  await titleInput.fill("");
  await titleInput.press("Tab");
  await expect(titleInput).toHaveValue("24");
  await titleInput.fill("37");
  await titleInput.press("Tab");
  await expect(page.locator(".font-preview-title")).toHaveCSS(
    "font-size",
    "37px",
  );
  await expect(page.locator(".font-preview-subtitle")).toHaveCSS(
    "font-size",
    "16px",
  );
  await expect(page.locator(".font-preview p")).toHaveCSS("font-size", "12px");
  await expect(page.locator(".font-preview small")).toHaveCSS(
    "font-size",
    "12px",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".chapter-intro h1")).toHaveCSS(
    "font-size",
    "37px",
  );
  await expect(page.locator(".node-body h2").first()).toHaveCSS(
    "font-size",
    "16px",
  );
  await expect(page.locator(".node-body p").first()).toHaveCSS(
    "font-size",
    "12px",
  );
  await expect(page.locator(".node-body p").first()).toHaveText(originalText!);
  await page.reload();
  await expect(page.locator(".chapter-intro h1")).toHaveCSS(
    "font-size",
    "37px",
  );
  await settings(page);
  await expect(titleInput).toHaveValue("37");
  await page.getByRole("button", { name: "Reset font sizes" }).focus();
  await page.keyboard.press("Space");
  for (const control of fontControls)
    await expect(
      page.getByRole("slider", { name: control.label, exact: true }),
    ).toHaveValue(String(control.default));
});

for (const limit of ["min", "max"] as const) {
  test(`font ${limit} sizes reflow at phone, tablet, and desktop widths`, async ({
    page,
  }) => {
    await page.goto("/");
    await settings(page);
    for (const control of fontControls) {
      const slider = page.getByRole("slider", {
        name: control.label,
        exact: true,
      });
      await slider.focus();
      await slider.press(limit === "min" ? "Home" : "End");
    }
    await closeSettings(page);
    await fits(page, [
      ".outline-panel",
      ".inspector",
      ".canvas-scroll",
      ".canvas-board",
    ]);
    await page.screenshot({ path: `test-results/fonts-panels-${limit}.png` });
    await settings(page);
    for (const width of [320, 375, 600, 800, 1100, 1440, 1920]) {
      await page.setViewportSize({ width, height: 720 });
      await fits(page, [
        "html",
        ".modal",
        ".font-setting-inputs",
        ".font-preview",
      ]);
      await page
        .getByRole("button", { name: "Reset font sizes" })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByRole("button", { name: "Reset font sizes" }),
      ).toBeInViewport();
      if (width === 320 || width === 1440)
        await page.screenshot({
          path: `test-results/font-dialog-${limit}-${width}.png`,
        });
      await closeSettings(page);
      await fits(page, [
        "html",
        ".topbar",
        ".canvas-toolbar",
        ".canvas-bottom",
        ".canvas-scroll",
        ".canvas-board",
        ".node-card",
        ".canvas-area",
      ]);
      const cog = page.getByRole("button", { name: "Settings", exact: true });
      await expect(cog).toBeInViewport();
      await page.screenshot({
        path: `test-results/fonts-${limit}-${width}.png`,
        fullPage: true,
      });
      await settings(page);
    }
    await closeSettings(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page
      .getByRole("button", { name: "Compact view", exact: true })
      .click();
    await fits(page, [".canvas-scroll", ".node-card"]);
    await page
      .getByRole("button", { name: "My projects", exact: true })
      .click();
    for (const width of [320, 800, 1440]) {
      await page.setViewportSize({ width, height: 720 });
      await fits(page, [
        "html",
        ".dashboard",
        ".project-grid",
        ".project-card",
      ]);
    }
  });
}

test("PHP sign-in exposes the same settings before authentication", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.STORYTRACKS_PHP = true;
  });
  await page.route("**/api.php?action=session", (route) =>
    route.fulfill({
      json: { authenticated: false },
    }),
  );
  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto("/");
  await settings(page);
  await page.getByRole("slider", { name: "Titles", exact: true }).press("End");
  await closeSettings(page);
  await expect(page.locator(".login h1")).toHaveCSS("font-size", "48px");
  await fits(page, ["html", ".login"]);
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("mixed font limits keep writing, planning, and sidebars usable on phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto("/");
  await settings(page);
  for (const control of fontControls) {
    await page
      .getByRole("slider", { name: control.label, exact: true })
      .press(control.key === "system" ? "Home" : "End");
  }
  await closeSettings(page);
  await page.getByRole("button", { name: "Open outline", exact: true }).click();
  await fits(page, [".outline-panel"]);
  await page.getByRole("tab", { name: "World building", exact: true }).click();
  await page
    .getByRole("button", { name: "Collapse outline", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add world entry", exact: true })
    .click();
  await page
    .getByLabel("World entry 1 title", { exact: true })
    .fill("A very long world entry with a place name");
  await page
    .getByLabel("World entry 1 details", { exact: true })
    .fill("A readable description at the largest body size.");
  await fits(page, ["html", ".planning-workspace", ".planning-card"]);
  await page.screenshot({ path: "test-results/fonts-mixed-planning-320.png" });
  await page
    .getByRole("button", { name: "Back to canvas", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open inspector", exact: true })
    .click();
  await fits(page, [".inspector"]);
  await expect(
    page.getByRole("button", { name: "Collapse inspector", exact: true }),
  ).toBeInViewport();
  await page
    .getByRole("button", { name: "Collapse inspector", exact: true })
    .click();
  await page.locator(".node-title-button").first().click();
  await page
    .getByLabel("Content block 1", { exact: true })
    .fill("Text is still editable at maximum font size.");
  await expect(page.getByLabel("Content block 1", { exact: true })).toHaveCSS(
    "font-size",
    "24px",
  );
  await fits(page, ["html", ".node-card", ".node-edit"]);
});

test("stored font sizes reject invalid values and clamp out-of-range numbers", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "storytracks-font-sizes",
      JSON.stringify({
        titles: 999,
        subtitles: -20,
        main: "huge",
        system: null,
      }),
    ),
  );
  await page.goto("/");
  await settings(page);
  await expect(
    page.getByRole("slider", { name: "Titles", exact: true }),
  ).toHaveValue("48");
  await expect(
    page.getByRole("slider", { name: "Subtitles", exact: true }),
  ).toHaveValue("16");
  await expect(
    page.getByRole("slider", { name: "Main text", exact: true }),
  ).toHaveValue("14");
  await expect(
    page.getByRole("slider", { name: "System text", exact: true }),
  ).toHaveValue("13");
});
