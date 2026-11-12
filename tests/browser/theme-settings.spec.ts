import { test, expect } from "@playwright/test";
import { themes } from "../../apps/web/src/themes";

test("all eight themes cover the workspace and persist after reopening", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const originalText = await page.locator(".node-body p").first().textContent();
  for (const theme of themes) {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const choices = page.getByRole("group", { name: "Color themes" });
    await expect(choices.getByRole("button")).toHaveCount(8);
    const choice = choices.getByRole("button", {
      name: theme.name,
      exact: true,
    });
    await choice.focus();
    await page.keyboard.press("Space");
    await expect(choice).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme.id);
    await expect(page.locator("html")).toHaveCSS("color-scheme", theme.scheme);
    await page.screenshot({
      path: `test-results/theme-${theme.id}-settings.png`,
    });
    await page.getByRole("button", { name: "Close dialog" }).click();
    const sections = page.locator(".inspector-scroll > .inspector-section");
    await expect(sections.nth(0)).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(sections.nth(1)).not.toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(sections.nth(2)).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    const chapters = page.locator(".chapter-group");
    await expect(chapters.nth(0)).not.toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(chapters.nth(1)).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(page.locator(".node-body p").first()).toHaveText(
      originalText!,
    );
    await page.screenshot({
      path: `test-results/theme-${theme.id}-workspace.png`,
    });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme.id);
  }
  const context = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  const reopened = await context.newPage();
  await reopened.goto("/");
  await expect(reopened.locator("html")).toHaveAttribute(
    "data-theme",
    "evening",
  );
  await context.close();
});

test("PHP sign-in and narrow settings share the saved theme", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.STORYTRACKS_PHP = true;
    localStorage.setItem("storytracks-theme", "frost");
  });
  await page.route("**/api.php?action=session", (route) =>
    route.fulfill({ json: { authenticated: false } }),
  );
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "frost");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Morning", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "morning");
  for (const selector of ["html", ".modal", ".theme-grid", ".theme-choice"]) {
    expect(
      await page
        .locator(selector)
        .evaluateAll((elements) =>
          elements.every((el) => el.scrollWidth <= el.clientWidth + 1),
        ),
    ).toBe(true);
  }
  await page.screenshot({ path: "test-results/theme-phone-settings.png" });
});

test("unavailable storage still allows a session theme and explains persistence", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "storytracks-theme") throw new Error("Storage unavailable");
      return original.call(this, key, value);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Night", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page.locator(".theme-settings [role=status]")).toContainText(
    "cannot be remembered",
  );
});

test("glass surfaces keep story editing and connected notes usable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("storytracks-theme", "glass"),
  );
  await page.goto("/");
  await page.locator(".node-title-button").first().click();
  await page
    .getByLabel("Content block 1", { exact: true })
    .fill("A clear view through the glass.");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Add sub-context", exact: true })
    .click();
  await page
    .getByLabel("Sub-context note 1", { exact: true })
    .fill("Reflections around the edges.");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".node-body p").first()).toHaveText(
    "A clear view through the glass.",
  );
  await expect(
    page.getByLabel("Sub-context note 1", { exact: true }),
  ).toHaveValue("Reflections around the edges.");
  await page.setViewportSize({ width: 375, height: 800 });
  await page.locator(".node-title-button").first().click();
  await page
    .getByLabel("Content block 1", { exact: true })
    .fill("Glass remains editable on a phone.");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".node-body p").first()).toHaveText(
    "Glass remains editable on a phone.",
  );
  await page.screenshot({ path: "test-results/theme-glass-phone.png" });
});
