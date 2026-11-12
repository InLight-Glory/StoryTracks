import { test, expect } from "@playwright/test";
import {
  newProject,
  newNode,
  newSection,
  newChapter,
} from "../../apps/web/src/domain";
import { createRequire } from "node:module";
const JSZip = createRequire(import.meta.url)("jszip");

test("Shift ranges, clear search, part focus and the Replace toggle share one Find workflow", async ({
  page,
}) => {
  const p = newProject("Range and find");
  const second = newChapter(p.sections[0].id, "Second chapter");
  p.chapters.push(second);
  for (let i = 1; i <= 6; i++)
    p.nodes.push(
      newNode(i <= 3 ? p.chapters[0].id : second.id, `Node ${i}`, "needle"),
    );
  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(p));
  await page.goto("/");
  await page.getByRole("button", { name: "My projects", exact: true }).click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "range.storytracks",
      mimeType: "application/zip",
      buffer: await zip.generateAsync({ type: "nodebuffer" }),
    });
  await page.getByRole("button", { name: "Organize", exact: true }).click();
  await page.getByLabel("Select node Node 2", { exact: true }).check();
  await page
    .getByLabel("Select node Node 5", { exact: true })
    .click({ modifiers: ["Shift"] });
  for (let i = 1; i <= 6; i++)
    await expect(
      page.getByLabel(`Select node Node ${i}`, { exact: true }),
    ).toBeChecked({ checked: i >= 2 && i <= 5 });
  await page
    .getByLabel("Select node Node 1", { exact: true })
    .click({ modifiers: ["Shift"] });
  for (let i = 1; i <= 5; i++)
    await expect(
      page.getByLabel(`Select node Node ${i}`, { exact: true }),
    ).toBeChecked();
  await page
    .getByRole("button", { name: "Done organizing", exact: true })
    .click();
  await page.getByLabel("Search story", { exact: true }).fill("needle");
  await expect(page.locator(".node-card")).toHaveCount(3);
  await page.getByRole("button", { name: "01 Part one", exact: true }).click();
  await expect(page.locator(".node-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await expect(page.getByLabel("Find text", { exact: true })).toHaveValue(
    "needle",
  );
  await expect(page.getByLabel("Search in", { exact: true })).toHaveValue(
    p.sections[0].id,
  );
  await expect(page.getByText("6 matches", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Replace with", { exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Replace", exact: true }).check();
  await expect(page.getByLabel("Replace with", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Replace", exact: true }).uncheck();
  await expect(page.getByLabel("Replace with", { exact: true })).toHaveCount(0);
  await page.getByRole("dialog").getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.getByLabel("Find text", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.getByLabel("Search story", { exact: true })).toHaveValue(
    "",
  );
  await page.getByLabel("Search story", { exact: true }).fill("missing");
  await page
    .locator(".outline-search")
    .getByRole("button", { name: "Clear search", exact: true })
    .click();
  await expect(page.locator(".node-card")).toHaveCount(6);
});

test("left-panel bulk organization and find/replace persist and undo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const p = newProject("Editing tools");
  const part = newSection("Part two");
  p.sections.push(part);
  const chapter = newChapter(part.id, "Destination");
  p.chapters.push(chapter);
  p.nodes.push(
    newNode(p.chapters[0].id, "Alpha", "A red bird."),
    newNode(p.chapters[0].id, "Beta", "A red sky."),
  );
  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(p));
  await page.goto("/");
  await page.getByRole("button", { name: "My projects", exact: true }).click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "tools.storytracks",
      mimeType: "application/zip",
      buffer: await zip.generateAsync({ type: "nodebuffer" }),
    });
  await page.getByRole("button", { name: "Organize", exact: true }).click();
  expect(
    (await page.locator(".outline-tree").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(110);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Select node Alpha", { exact: true }).check();
  await page.getByLabel("Select node Beta", { exact: true }).check();
  await page
    .getByLabel("Organize destination", { exact: true })
    .selectOption("part:" + part.id);
  await page
    .getByRole("button", { name: "Move selected", exact: true })
    .click();
  await expect(
    page.locator(".chapter-group").filter({
      has: page.getByLabel("Select chapter Untitled chapter", {
        exact: true,
      }),
    }),
  ).toHaveCount(0); // node selection mode
  await expect(
    page.locator(".chapter-group").filter({ hasText: "Untitled chapter" }),
  ).toContainText("Alpha");
  await expect(
    page.locator(".chapter-group").filter({ hasText: "Untitled chapter" }),
  ).toContainText("Beta");
  await page
    .getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })
    .click();
  await expect(
    page.locator(".chapter-group").filter({ hasText: "Untitled chapter" }),
  ).toHaveCount(0);
  await page.getByLabel("Select node Alpha", { exact: true }).check();
  await page.getByLabel("Select node Beta", { exact: true }).check();
  await page
    .getByLabel("Organize destination", { exact: true })
    .selectOption(chapter.id);
  await page
    .getByRole("button", { name: "Copy selected", exact: true })
    .click();
  await expect(
    page.locator(".chapter-group").filter({ hasText: "Destination" }),
  ).toContainText("Alpha");
  await page
    .getByLabel("Organize item type", { exact: true })
    .selectOption("chapters");
  await page.getByLabel("Select chapter Chapter one", { exact: true }).check();
  await page.getByLabel("Select chapter Destination", { exact: true }).check();
  await page
    .getByLabel("Organize destination", { exact: true })
    .selectOption(part.id);
  await page
    .getByRole("button", { name: "Move selected", exact: true })
    .click();
  await expect(
    page.locator(".section-group").filter({ hasText: "Part two" }),
  ).toContainText("Chapter one");
  await page.getByRole("button", { name: "Whole book", exact: true }).click();
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await page.getByRole("checkbox", { name: "Replace", exact: true }).check();
  await page.getByLabel("Find text", { exact: true }).fill("red");
  await expect(
    page.getByText("4 matches · 4 replaceable", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Replace with", { exact: true }).fill("peach");
  await page
    .getByRole("button", { name: "Replace all (4)", exact: true })
    .click();
  await expect(
    page.getByText("0 matches · 0 replaceable", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })
    .click();
  await page.keyboard.press("Control+h");
  await page.getByLabel("Find text", { exact: true }).fill("red");
  await expect(
    page.getByText("4 matches · 4 replaceable", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Replace with", { exact: true }).fill("peach");
  await page
    .getByRole("button", { name: "Replace all (4)", exact: true })
    .click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Find", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+f");
  await page.getByLabel("Find text", { exact: true }).fill("peach");
  await expect(page.getByText("4 matches", { exact: true })).toBeVisible();
});
