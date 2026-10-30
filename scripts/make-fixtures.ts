import { writeFileSync, mkdirSync } from "node:fs";
import { demoProject, newNode, uid } from "../apps/web/src/domain";
import { publication } from "../apps/web/src/export";
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
