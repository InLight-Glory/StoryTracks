import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { duplicateProject, type Project } from "../../apps/web/src/domain";

const legacy: Project = JSON.parse(
  readFileSync(new URL("../fixtures/legacy-starter.json", import.meta.url), "utf8"),
);

test("opening an older library replaces its original starter and preserves an edited copy", async ({
  page,
}) => {
  const original = duplicateProject(legacy);
  original.name = legacy.name;
  original.revision = 1;
  const edited = duplicateProject(original);
  edited.name = legacy.name;
  edited.revision = 1;
  edited.nodes[0].blocks[0].text = "My own opening, saved before updating.";
  await page.goto("/");
  const chapter = page.locator(".chapter-intro h1");
  await expect(chapter).toHaveText("The parable of the sower");

  await page.evaluate(
    async ({ original, edited }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("storytracks-v1", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("projects", "readwrite");
          const store = transaction.objectStore("projects");
          store.clear();
          store.put(original);
          store.put(edited);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
      localStorage.setItem("storytracks-last", original.id);
      localStorage.setItem(
        `storytracks-ui-${original.id}`,
        JSON.stringify({
          chapter: original.chapters[1].id,
          selected: original.nodes[4].id,
          scroll: 200,
        }),
      );
    },
    { original, edited },
  );

  for (let launch = 0; launch < 2; launch++) {
    await page.reload();
    await expect(chapter).toHaveText("The parable of the sower");
    await expect(page.locator(".node-card.selected")).toContainText(
      "Teaching by the sea",
    );
    const projects = await page.evaluate(
      () =>
        new Promise<Project[]>((resolve, reject) => {
          const request = indexedDB.open("storytracks-v1", 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            const read = database
              .transaction("projects")
              .objectStore("projects")
              .getAll();
            read.onsuccess = () => {
              database.close();
              resolve(read.result);
            };
            read.onerror = () => reject(read.error);
          };
        }),
    );
    expect(projects).toHaveLength(2);
    expect(projects.find((p) => p.id === original.id)).toMatchObject({
      name: "The Parable of the Sower",
      revision: 2,
    });
    expect(projects.find((p) => p.id === edited.id)).toEqual(edited);
  }
});
