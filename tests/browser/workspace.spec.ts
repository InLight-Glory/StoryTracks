import { test, expect } from "@playwright/test";
import {
  newProject,
  newChapter,
  newNode,
  textBlock,
} from "../../apps/web/src/domain";
import { createRequire } from "node:module";
const JSZip = createRequire(import.meta.url)("jszip");

test("create, import, edit, save and reopen a story", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "My projects", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox")
    .first()
    .fill("Browser acceptance story");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page
    .getByLabel("Text to import")
    .fill("First line\nsecond line\n\nThird paragraph");
  await page
    .getByRole("button", { name: "Import 2 nodes", exact: true })
    .click();
  await expect(page.locator(".node-card")).toHaveCount(2);
  await page.locator(".node-title-button").first().click();
  await page
    .getByLabel("Node title", { exact: true })
    .fill("The empty platform");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".node-card")).toHaveCount(2);
  await expect(page.locator(".node-title-button").first()).toHaveText(
    "The empty platform",
  );
  await page.locator(".node-title-button").first().click();
  await expect(page.getByLabel("Content block 1", { exact: true })).toHaveValue(
    "First line\nsecond line",
  );
});

test("archive identity collision requires a choice and preserves the existing story", async ({
  page,
}) => {
  const project = newProject("Archive original");
  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(project));
  const payload = {
    name: "original.storytracks",
    mimeType: "application/zip",
    buffer: await zip.generateAsync({ type: "nodebuffer" }),
  };
  await page.goto("/");
  await page.getByRole("button", { name: "My projects", exact: true }).click();
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(payload);
  await expect(page.locator(".breadcrumb")).toContainText("Archive original");
  await input.setInputFiles(payload);
  await expect(page.getByRole("dialog")).toContainText(
    "This story is already on your desk.",
  );
  await page
    .getByRole("button", { name: "Import a copy", exact: true })
    .click();
  await expect(page.locator(".breadcrumb")).toContainText(
    "Archive original (copy)",
  );
  await page.getByRole("button", { name: "My projects", exact: true }).click();
  await expect(
    page.locator(".project-cover h3").filter({ hasText: /^Archive original$/ }),
  ).toHaveCount(1);
});

test("sub-context and highlight notes persist independently from inspector side notes", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add sub-context", exact: true })
    .click();
  await page
    .getByLabel("Sub-context note 1", { exact: true })
    .fill("The family has kept the map for generations.");
  await page
    .getByLabel("Sub-context note 1 title", { exact: true })
    .fill("Family history");
  await page
    .getByRole("button", { name: "Add highlight", exact: true })
    .click();
  await page
    .getByLabel("Highlight note 1", { exact: true })
    .fill("Remember the station clock.");
  await page
    .getByRole("complementary", { name: "Highlight canvas area" })
    .getByRole("checkbox")
    .check();
  const connection = page.getByLabel("Sub-context connected node", {
    exact: true,
  });
  const originalNode = await connection.inputValue();
  await connection.selectOption({ index: 2 });
  await expect(
    page.getByLabel("Sub-context note 1", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Highlight note 1", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add sub-context", exact: true })
    .click();
  await page
    .getByLabel("Sub-context note 1", { exact: true })
    .fill("This feeling belongs to another node.");
  await connection.selectOption(originalNode);
  await expect(
    page.getByLabel("Sub-context note 1", { exact: true }),
  ).toHaveValue("The family has kept the map for generations.");
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page
    .getByLabel("Side note", { exact: true })
    .fill("An ordinary project side note.");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Sub-context note 1", { exact: true }),
  ).toHaveValue("The family has kept the map for generations.");
  await expect(
    page.getByLabel("Highlight note 1", { exact: true }),
  ).toHaveValue("Remember the station clock.");
  await expect(
    page
      .getByRole("complementary", { name: "Highlight canvas area" })
      .getByRole("checkbox"),
  ).toBeChecked();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(page.getByLabel("Side note", { exact: true })).toHaveValue(
    "An ordinary project side note.",
  );
  await page
    .getByLabel("Sub-context connected node", { exact: true })
    .selectOption({ index: 2 });
  await expect(
    page.getByLabel("Sub-context note 1", { exact: true }),
  ).toHaveValue("This feeling belongs to another node.");
});

test("2,000-node whole book mounts a bounded canvas and supports editing its final node", async ({
  page,
}) => {
  test.setTimeout(60000);
  const project = newProject("Large story");
  project.chapters = [];
  for (let c = 0; c < 100; c++) {
    const chapter = newChapter(project.sections[0].id, `Chapter ${c + 1}`);
    project.chapters.push(chapter);
    for (let n = 0; n < 20; n++) {
      const node = newNode(chapter.id);
      node.title = `Moment ${c * 20 + n + 1}`;
      node.blocks = [
        textBlock(
          "A short scene with enough detail to establish a place, a person, and a change.",
        ),
      ];
      project.nodes.push(node);
    }
  }
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "My projects", exact: true }),
  ).toBeVisible();
  await page.evaluate(async (project) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("storytracks-v1", 1);
      request.onsuccess = () => {
        const tx = request.result.transaction("projects", "readwrite");
        tx.objectStore("projects").put(project);
        tx.oncomplete = () => {
          request.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
    localStorage.setItem("storytracks-last", project.id);
    localStorage.setItem(
      "storytracks-ui-" + project.id,
      JSON.stringify({ all: true }),
    );
  }, project);
  const started = Date.now();
  await page.reload();
  await expect(page.locator(".track-step")).toHaveCount(2000);
  const readyMs = Date.now() - started;
  console.log(
    `2,000 nodes / 100 chapters editable in ${readyMs} ms; mounted cards: ${await page.locator(".node-card").count()}`,
  );
  expect(readyMs).toBeLessThan(3000);
  expect(await page.locator(".node-card").count()).toBeLessThan(30);
  await page.locator(".canvas-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page
    .locator(".node-title-button")
    .filter({ hasText: /^Moment 2000$/ })
    .click();
  await page.getByLabel("Node title", { exact: true }).evaluate((input) => {
    input.addEventListener(
      "input",
      () => {
        const start = performance.now();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            (input as HTMLElement).dataset.editLatency = String(
              performance.now() - start,
            );
          }),
        );
      },
      { once: true, capture: true },
    );
  });
  const editStarted = Date.now();
  await page.getByLabel("Node title", { exact: true }).fill("Final moment");
  await expect(page.getByLabel("Node title", { exact: true })).toHaveValue(
    "Final moment",
  );
  console.log(
    `Large-project title edit round trip: ${Date.now() - editStarted} ms`,
  );
  await expect(page.getByLabel("Node title", { exact: true })).toHaveAttribute(
    "data-edit-latency",
    /\d/,
  );
  const feedbackMs = Number(
    await page
      .getByLabel("Node title", { exact: true })
      .getAttribute("data-edit-latency"),
  );
  console.log(
    `Large-project input to second animation frame: ${feedbackMs.toFixed(1)} ms`,
  );
  expect(feedbackMs).toBeLessThan(100);
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  expect(await page.locator(".node-card").count()).toBeLessThan(30);
});
