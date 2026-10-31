import { writeFileSync, mkdirSync } from "node:fs";
import { demoProject, newNode, uid } from "../apps/web/src/domain";
import { publication } from "../apps/web/src/export";
import { addGuide, workbook, suggestQuestions } from "../apps/web/src/planning";
const p = demoProject();
p.name = "Fixture Book";
p.createdAt = p.updatedAt = "2026-01-01T00:00:00.000Z";
p.revision = 0;
p.resources.push({
  id: uid(),
  title: "Interview",
  kind: "historical_transcript",
  text: "00:01 Speaker: Keep these words exactly.",
  source: "interview.txt",
  createdAt: p.createdAt,
  include: true,
});
const t = p.templates[0];
addGuide(p, "selfhelp");
const book = workbook(p);
book.prompts[0].answer =
  "A reader who wants to build a sustainable writing practice.";
book.prompts[0].include = true;
book.world.push({
  id: uid(),
  category: "Places & geography",
  title: "Bellwether",
  description: "A river town built around an abandoned station.",
  include: true,
});
book.questions.push({
  id: uid(),
  statement: "Consistency matters more than intensity.",
  source: "Author’s working note",
  candidates: suggestQuestions("Consistency matters more than intensity."),
  question: "Should I focus on consistency or intensity?",
  insight: "A small routine may be easier to sustain.",
  alternatives: "A planned burst can help with a short deadline.",
  audience: "Writers balancing work and family.",
  hook: "What if a small daily practice is enough to begin?",
  include: true,
});
p.notes.push(
  {
    id: uid(),
    ownerId: p.nodes[0].id,
    canvasArea: "subcontext",
    title: "Hidden history",
    text: "The town remembers the old bridge.",
    include: true,
  },
  {
    id: uid(),
    ownerId: p.nodes[1].id,
    canvasArea: "highlight",
    title: "Recurring detail",
    text: "The station clock is seven minutes slow.",
    include: true,
  },
  {
    id: uid(),
    ownerId: p.id,
    canvasArea: "highlight",
    title: "Private note",
    text: "Do not publish this reminder.",
    include: false,
  },
);
p.nodes.push({
  ...newNode(p.chapters[0].id),
  templateId: t.id,
  blocks: [],
  importance: 2,
  liberty: 11,
});
mkdirSync("contracts", { recursive: true });
writeFileSync(
  "contracts/fixtures.json",
  JSON.stringify(
    {
      schemaVersion: 1,
      splits: [
        {
          input: "First line\nsecond line\n\nThird paragraph",
          output: ["First line\nsecond line", "Third paragraph"],
        },
        {
          input: "\uFEFFOne\r\ntwo\r\n \t\r\nThree\r\n\r\n",
          output: ["One\ntwo", "Three"],
        },
        { input: "\n\n\t \n", output: [] },
        { input: "A\n\n\n\nB", output: ["A", "B"] },
      ],
      project: p,
      publication: publication(p),
    },
    null,
    2,
  ) + "\n",
);
console.log("Shared behavioral fixture created.");
