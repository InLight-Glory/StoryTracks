import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addCanvasNote,
  editCanvasNote,
  newProject,
  newNode,
  duplicateProject,
  uid,
  validateProject,
} from "../apps/web/src/domain";
import { archiveBlob, publication, readArchive } from "../apps/web/src/export";
test("node-connected thoughts and commentary survive exchange and follow publication inclusion", async () => {
  const p = newProject("A story");
  const a = newNode(p.chapters[0].id, "Arrival"),
    b = newNode(p.chapters[0].id, "Departure");
  p.nodes.push(a, b);
  const thought = addCanvasNote(p, a.id, "subcontext"),
    comment = addCanvasNote(p, b.id, "highlight");
  thought.text = "I feel uneasy about this moment.";
  thought.include = true;
  comment.text = "Echo the opening image here.";
  comment.include = true;
  assert.ok(publication(p).markdown.includes("Connected node: Arrival"));
  b.suspended = true;
  assert.ok(!publication(p).markdown.includes(comment.text));
  assert.ok(publication(p, true).markdown.includes(comment.text));
  b.trashed = true;
  assert.ok(!publication(p, true).markdown.includes(comment.text));
  const backup = await archiveBlob(p),
    restored = await readArchive(new File([backup.blob], "nodes.storytracks"));
  assert.deepEqual(restored.notes, p.notes);
  const copy = duplicateProject(p);
  assert.equal(copy.notes[0].ownerId, copy.nodes[0].id);
  assert.notEqual(copy.notes[0].ownerId, a.id);
});
test("locks protect connected notes and legacy notes can be assigned without losing text", () => {
  const p = newProject("Notes"),
    a = newNode(p.chapters[0].id),
    b = newNode(p.chapters[0].id);
  p.nodes.push(a, b);
  const note = addCanvasNote(p, a.id, "highlight");
  a.locked = true;
  assert.throws(() => addCanvasNote(p, a.id, "subcontext"), /locked/);
  assert.throws(
    () => editCanvasNote(p, note.id, { text: "Changed" }),
    /locked/,
  );
  assert.throws(() => editCanvasNote(p, note.id, { ownerId: b.id }), /locked/);
  assert.throws(() => editCanvasNote(p, note.id, null), /locked/);
  const legacy = {
    id: uid(),
    ownerId: p.id,
    canvasArea: "subcontext" as const,
    title: "Earlier",
    text: "Keep this thought",
    include: false,
  };
  p.notes.push(legacy);
  assert.throws(
    () => editCanvasNote(p, legacy.id, { ownerId: a.id }),
    /locked/,
  );
  editCanvasNote(p, legacy.id, { ownerId: b.id });
  assert.equal(legacy.text, "Keep this thought");
  assert.equal(legacy.ownerId, b.id);
  validateProject(p);
  b.trashed = true;
  assert.throws(() => addCanvasNote(p, b.id, "highlight"), /Select a node/);
});
