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
  const output = publication(p).markdown;
  assert.ok(
    output.indexOf("#### Node: Arrival") < output.indexOf(thought.text),
  );
  assert.ok(
    output.indexOf(thought.text) < output.indexOf("#### Node: Departure"),
  );
  assert.ok(
    output.indexOf("#### Node: Departure") < output.indexOf(comment.text),
  );
  assert.match(output, /##### Author’s thoughts\n\n> I feel uneasy/);
  assert.match(output, /##### Commentary\n\n> Echo the opening/);
  assert.ok(!output.includes("## Context and side notes"));
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

test("publication keeps notes at every scope, including empty sections, without duplicates", () => {
  const p = newProject("Scoped notes");
  const a = newNode(p.chapters[0].id, "Arrival"),
    b = newNode(p.chapters[0].id, "Departure");
  p.nodes.push(a, b);
  const empty = { ...p.sections[0], id: uid(), title: "Empty section" };
  p.sections.push(empty);
  const notes = [
    [p.id, "Project context"],
    [p.sections[0].id, "Section context"],
    [p.chapters[0].id, "Chapter context"],
    [a.id, "First paragraph\r\n\r\n- **A detail**\r\n- Another detail"],
    [empty.id, "Empty section context"],
  ];
  for (const [ownerId, text] of notes)
    p.notes.push({ id: uid(), ownerId, text, include: true });
  const out = publication(p).markdown;
  const inOrder = [
    "## Project notes",
    "Project context",
    "## Section:",
    "Section context",
    "### Chapter",
    "#### Chapter writing guidance",
    "Chapter context",
    "#### Node: Arrival",
    "First paragraph",
    "#### Node: Departure",
    "## Section: Empty section",
    "Empty section context",
  ];
  let previous = -1;
  for (const text of inOrder) {
    const position = out.indexOf(text, previous + 1);
    assert.ok(position > previous, `${text} appears in its scope`);
    previous = position;
  }
  assert.match(
    out,
    /> First paragraph\n> \n> - \*\*A detail\*\*\n> - Another detail/,
  );
  for (const [, text] of notes)
    assert.equal(out.split(text.split("\r")[0]).length - 1, 1);
  p.sections[0].suspended = true;
  const activeOnly = publication(p).markdown;
  assert.ok(!activeOnly.includes("Section context"));
  assert.ok(!activeOnly.includes("Chapter context"));
  assert.ok(!activeOnly.includes("First paragraph"));
  assert.ok(activeOnly.includes("Empty section context"));
  assert.ok(publication(p, true).markdown.includes("First paragraph"));
  p.sections[0].trashed = true;
  assert.ok(!publication(p, true).markdown.includes("First paragraph"));
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
