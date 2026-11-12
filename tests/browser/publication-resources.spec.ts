import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { newProject, newNode, addCanvasNote } from "../../apps/web/src/domain";
const JSZip = createRequire(import.meta.url)("jszip");

test("formatted and plain publication previews show the same story", async ({
  page,
}) => {
  const p = newProject("Preview test");
  p.nodes.push(newNode(p.chapters[0].id, "A moment", "A **bold** decision."));
  const thought = addCanvasNote(p, p.nodes[0].id, "subcontext");
  thought.include = true;
  thought.text = "Keep the **uncertainty**.\n\n- Let the choice linger.";
  const commentary = addCanvasNote(p, p.nodes[0].id, "highlight");
  commentary.include = true;
  commentary.text = "Echo this decision later.";
  p.nodes.push(
    newNode(p.chapters[0].id, "Next moment", "The journey continues."),
  );
  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(p));
  await page.goto("/");
  await page.getByRole("button", { name: "My projects", exact: true }).click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "preview.storytracks",
      mimeType: "application/zip",
      buffer: await zip.generateAsync({ type: "nodebuffer" }),
    });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText("Preview the storytrack", { exact: true }).click();
  await expect(page.locator(".publication-formatted h1")).toHaveText(
    "Preview test — StoryTrack",
  );
  await expect(page.locator(".publication-metadata")).not.toHaveAttribute(
    "open",
  );
  await expect(
    page.locator(".publication-formatted strong").filter({ hasText: "bold" }),
  ).toBeVisible();
  await expect(page.locator(".publication-formatted h5")).toHaveText([
    "Author’s thoughts",
    "Commentary",
  ]);
  await expect(page.locator(".publication-formatted blockquote")).toHaveCount(
    2,
  );
  await expect(
    page.locator(".publication-formatted blockquote strong"),
  ).toHaveText("uncertainty");
  await expect(page.locator(".publication-formatted blockquote li")).toHaveText(
    "Let the choice linger.",
  );
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await expect(
    page.getByLabel("Plain publication preview", { exact: true }),
  ).toContainText("A **bold** decision.");
  await expect(page.getByLabel("Plain publication preview")).toContainText(
    "##### Author’s thoughts\n\n> Keep the **uncertainty**.\n> \n> - Let the choice linger.",
  );
  await page.getByRole("button", { name: "Formatted", exact: true }).click();
  await expect(page.locator(".publication-formatted")).toContainText(
    "A bold decision.",
  );
});

test("local text resources with generic MIME open, persist and download under desktop-style CSP", async ({
  page,
}) => {
  await page.route("http://127.0.0.1:5188/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        "Content-Security-Policy": "connect-src 'self'",
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Resources", exact: true }).click();
  const content = "# Field notes\r\nA **bold** idea — café.\r\n";
  const bytes = Buffer.from(content, "utf8");
  await page
    .locator('input[accept="image/*,audio/*,.pdf,.txt,.md"]')
    .setInputFiles({
      name: "field-notes.md",
      mimeType: "application/octet-stream",
      buffer: bytes,
    });
  const card = page
    .locator(".resource-card")
    .filter({ hasText: "field-notes.md" });
  await expect(card).toContainText("A **bold** idea — café.");
  await card
    .getByRole("button", { name: "field-notes.md", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Content", exact: true }),
  ).toHaveValue(content.replaceAll("\r\n", "\n"));
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Resources", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page
    .locator(".resource-card")
    .filter({ hasText: "field-notes.md" })
    .getByRole("button", { name: "Download attachment", exact: true })
    .click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("field-notes.md");
  expect(readFileSync((await download.path())!)).toEqual(bytes);
});
