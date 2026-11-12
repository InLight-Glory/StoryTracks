import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("first-time tutorial can be skipped, replayed, and completed", async ({
  page,
}) => {
  await page.goto("/");
  const tour = page.getByRole("dialog", { name: "First-time tutorial" });
  await expect(tour).toBeVisible();
  await tour.getByRole("button", { name: "Skip tutorial" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "My projects", exact: true }),
  ).toBeVisible();
  await expect(tour).toHaveCount(0);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Open tutorial", exact: true })
    .click();
  await expect(tour.getByText("Step 1 of 7 · Welcome")).toBeVisible();
  const next = tour.getByRole("button", { name: "Next", exact: true });
  await next.click();
  await next.click();
  await tour
    .getByRole("button", { name: "Collapse practice Outline", exact: true })
    .click();
  await expect(
    tour.getByRole("button", { name: "Expand practice Outline", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await tour
    .getByRole("button", { name: "Expand practice Outline", exact: true })
    .click();
  await tour
    .getByRole("button", { name: "Collapse practice Sub-context", exact: true })
    .click();
  await expect(
    tour.getByRole("button", {
      name: "Expand practice Sub-context",
      exact: true,
    }),
  ).toBeVisible();
  await next.click();
  await expect(tour.getByText("Step 4 of 7 · Project metadata")).toBeVisible();
  await tour.getByRole("button", { name: "Back", exact: true }).click();
  await expect(tour.getByText("Step 3 of 7 · Collapsing areas")).toBeVisible();
  for (let i = 0; i < 4; i++) await next.click();
  await tour
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Collapse outline", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Collapse Sub-context", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "My projects", exact: true }),
  ).toBeVisible();
  await expect(tour).toHaveCount(0);
});

test("keyboard dismissal works on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/");
  const tour = page.getByRole("dialog", { name: "First-time tutorial" });
  await expect(tour.getByRole("heading")).toBeFocused();
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open outline", exact: true }),
  ).toBeVisible();
  await expect(tour).toHaveCount(0);
});
