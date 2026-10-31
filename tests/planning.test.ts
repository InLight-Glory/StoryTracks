import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addGuide,
  projectFromTemplate,
  projectTemplates,
  suggestQuestions,
  workbook,
} from "../apps/web/src/planning";
import {
  duplicateProject,
  newProject,
  uid,
  validateProject,
} from "../apps/web/src/domain";
import { archiveBlob, publication, readArchive } from "../apps/web/src/export";

test("every project template creates independent editable chapters and unanswered prompts", () => {
  for (const template of projectTemplates) {
    const p = projectFromTemplate("A new book", "A premise", template.id);
    validateProject(p);
    assert.equal(p.chapters.length, template.stages.length);
    assert.equal(p.workbook?.prompts.length, template.stages.length * 2);
    assert.ok(p.workbook?.prompts.every((q) => !q.answer && !q.include));
    assert.equal(p.nodes.length, 0);
    const copy = duplicateProject(p);
    assert.equal(copy.workbook?.templateId, template.id);
    assert.notEqual(copy.workbook?.prompts[0].id, p.workbook?.prompts[0].id);
    validateProject(copy);
  }
});
test("adding guides preserves answers and outline content without repeating prompts", () => {
  const p = projectFromTemplate("Book", "", "mystery");
  p.workbook!.prompts[0].answer = "A missing letter.";
  const chapterIds = p.chapters.map((c) => c.id);
  const count = p.workbook!.prompts.length;
  addGuide(p, "mystery");
  assert.equal(p.workbook!.prompts.length, count);
  addGuide(p, "hero");
  assert.equal(p.workbook!.prompts[0].answer, "A missing letter.");
  assert.deepEqual(
    p.chapters.map((c) => c.id),
    chapterIds,
  );
});
test("question suggestions offer specific comparisons, causal questions, and alternatives", () => {
  assert.deepEqual(suggestQuestions("  "), []);
  assert.ok(
    suggestQuestions("Consistency matters more than intensity.").includes(
      "Should I focus on consistency or intensity?",
    ),
  );
  assert.ok(
    suggestQuestions("Writing every day builds confidence.").includes(
      "How can writing every day build confidence?",
    ),
  );
  assert.ok(
    suggestQuestions(
      "You don't need more time. You need fewer distractions.",
    ).includes("What do I need instead of more time?"),
  );
  assert.ok(
    suggestQuestions("The road curves.").some((q) =>
      q.includes("other answers"),
    ),
  );
});
test("workbook archives round trip; unpublished planning stays out of Markdown", async () => {
  const p = newProject("Workbook");
  const book = workbook(p);
  book.world.push({
    id: uid(),
    category: "History & conflict",
    title: "The bridge",
    description: "Hidden backstory",
    include: false,
  });
  book.questions.push({
    id: uid(),
    statement: "Writing builds confidence.",
    source: "Working note",
    candidates: suggestQuestions("Writing builds confidence."),
    question: "What builds confidence?",
    insight: "Practice",
    alternatives: "Support",
    audience: "New writers",
    hook: "Ready to find your voice?",
    include: true,
  });
  const out = publication(p).markdown;
  assert.ok(!out.includes("Hidden backstory"));
  assert.ok(out.includes("### Question studies"));
  assert.ok(out.includes("Audience: New writers"));
  const backup = await archiveBlob(p);
  const restored = await readArchive(
    new File([backup.blob], "workbook.storytracks"),
  );
  assert.deepEqual(restored.workbook, book);
});
test("invalid workbook types and duplicated IDs are rejected", () => {
  const p = projectFromTemplate("Book", "", "scifi");
  p.workbook!.prompts[0].id = p.id;
  assert.throws(() => validateProject(p), /Duplicate/);
  assert.throws(() =>
    validateProject({
      ...newProject("Invalid"),
      workbook: {
        templateId: "",
        prompts: [],
        world: [],
        questions: [{ id: uid(), include: true, candidates: [false] }],
      },
    }),
  );
});
