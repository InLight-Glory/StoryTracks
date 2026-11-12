import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateProject } from "../apps/web/src/domain";
import { archiveBlob, readArchive } from "../apps/web/src/export";

test("the standalone AI guide example validates and round-trips as an importable StoryTracks project", async () => {
  const guide = readFileSync("StoryTracks-AI-Document-Conversion.md", "utf8");
  const examples = [...guide.matchAll(/```json\r?\n([\s\S]*?)```/g)].map((m) =>
    JSON.parse(m[1]),
  );
  const p = validateProject(examples.find((p) => p.schemaVersion === 1));
  assert.equal(p.notes.length, 2);
  assert.ok(p.notes.every((n) => n.ownerId === p.nodes[0].id));
  const archive = await archiveBlob(p);
  const restored = await readArchive(
    new File([archive.blob], "example.storytracks"),
  );
  assert.deepEqual(restored, p);
});
