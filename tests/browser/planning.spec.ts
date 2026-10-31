import { test, expect } from "@playwright/test";
test("guided project, world building and reverse questions save and reopen", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "My projects", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox")
    .first()
    .fill("The missing letter");
  await page
    .getByLabel("Project template", { exact: true })
    .selectOption("mystery");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  const prompt = "What happened, and what explanation initially seems obvious?";
  await page
    .getByLabel(prompt, { exact: true })
    .fill("A letter vanished from a locked room.");
  await page
    .getByRole("button", { name: "Add answer to outline", exact: true })
    .first()
    .click();
  await page.getByRole("tab", { name: "World building", exact: true }).click();
  await page
    .getByRole("button", { name: "Add world entry", exact: true })
    .click();
  await page
    .getByLabel("World entry 1 title", { exact: true })
    .fill("Bellwether Station");
  await page
    .getByLabel("World entry 1 details", { exact: true })
    .fill("The clock is always seven minutes slow.");
  await page.getByRole("tab", { name: "Questions", exact: true }).click();
  await page
    .getByRole("button", { name: "New question study", exact: true })
    .click();
  await page
    .getByLabel("Statement or quote", { exact: true })
    .fill("Consistency matters more than intensity.");
  await page
    .getByLabel("Source or attribution", { exact: true })
    .fill("A working note");
  await page
    .getByRole("button", { name: "Find possible questions", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Should I focus on consistency or intensity?",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Alternative answers", { exact: true })
    .fill("A focused sprint can help with a deadline.");
  await page
    .getByLabel("Question audience", { exact: true })
    .fill("Writers with little free time.");
  await page
    .getByRole("button", { name: "Use question as hook", exact: true })
    .click();
  await expect(page.getByLabel("Marketing hook", { exact: true })).toHaveValue(
    "Should I focus on consistency or intensity?",
  );
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".node-card")).toHaveCount(1);
  await expect(page.locator(".node-card")).toContainText(
    "A letter vanished from a locked room.",
  );
  await page.getByRole("tab", { name: "Project guide", exact: true }).click();
  await expect(page.getByLabel(prompt, { exact: true })).toHaveValue(
    "A letter vanished from a locked room.",
  );
  await page.getByRole("tab", { name: "World building", exact: true }).click();
  await expect(
    page.getByLabel("World entry 1 title", { exact: true }),
  ).toHaveValue("Bellwether Station");
  await page.getByRole("tab", { name: "Questions", exact: true }).click();
  await expect(
    page.getByLabel("Underlying question", { exact: true }),
  ).toHaveValue("Should I focus on consistency or intensity?");
  await expect(
    page.getByLabel("Question audience", { exact: true }),
  ).toHaveValue("Writers with little free time.");
  await expect(page.getByLabel("Marketing hook", { exact: true })).toHaveValue(
    "Should I focus on consistency or intensity?",
  );
});
