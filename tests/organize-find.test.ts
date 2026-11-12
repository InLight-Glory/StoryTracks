import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newProject,
  newNode,
  newChapter,
  newSection,
  addCanvasNote,
  clone,
  validateProject,
} from "../apps/web/src/domain";
import { organize, selectRange } from "../apps/web/src/organize";
import { findMatches, replaceMatches, FindOptions } from "../apps/web/src/find";
test("Shift selection uses the latest anchor in either direction and preserves other selections", () => {
  const order = ["a", "b", "c", "d", "e"];
  assert.deepEqual(selectRange(["b"], order, "b", "e", true), [
    "b",
    "c",
    "d",
    "e",
  ]);
  assert.deepEqual(selectRange(["e"], order, "e", "b", true), [
    "e",
    "b",
    "c",
    "d",
  ]);
  assert.deepEqual(selectRange(["a", "d"], order, "d", "b", true), [
    "a",
    "d",
    "b",
    "c",
  ]);
  assert.deepEqual(selectRange(["b"], order, "b", "b", false), []);
});
test("Find and replacement respect chapter and part scope", () => {
  const p = newProject("Scopes");
  const c = newChapter(p.sections[0].id, "Second");
  p.chapters.push(c);
  const s = newSection("Other");
  p.sections.push(s);
  const other = newChapter(s.id);
  p.chapters.push(other);
  p.nodes.push(
    newNode(p.chapters[0].id, "", "needle"),
    newNode(c.id, "", "needle"),
    newNode(other.id, "", "needle"),
  );
  const opts: FindOptions = {
    query: "needle",
    matchCase: false,
    wholeWord: false,
    scope: "story",
    within: c.id,
  };
  assert.equal(findMatches(p, opts).length, 1);
  assert.equal(findMatches(p, { ...opts, within: p.sections[0].id }).length, 2);
  assert.equal(
    replaceMatches(p, { ...opts, within: p.sections[0].id }, "changed"),
    2,
  );
  assert.equal(p.nodes[2].blocks[0].text, "needle");
});

test("bulk moves preserve narrative order and create one unnamed chapter for a part destination", () => {
  const p = newProject("Moves");
  const part = newSection("Next");
  p.sections.push(part);
  const a = newNode(p.chapters[0].id, "A"),
    b = newNode(p.chapters[0].id, "B");
  p.nodes.push(a, b);
  organize(p, "nodes", [b.id, a.id], "move", "part:" + part.id);
  assert.equal(p.chapters.length, 2);
  assert.equal(p.chapters[1].title, "");
  assert.deepEqual(
    p.nodes.map((n) => n.title),
    ["A", "B"],
  );
  assert.ok(p.nodes.every((n) => n.chapterId === p.chapters[1].id));
  organize(
    p,
    "chapters",
    p.chapters.map((c) => c.id),
    "move",
    part.id,
  );
  assert.ok(p.chapters.every((c) => c.sectionId === part.id));
  validateProject(p);
});
test("copy parts and chapters deeply, preserving node annotations and independent IDs", () => {
  const p = newProject("Copy");
  const n = newNode(p.chapters[0].id, "Scene", "A thought");
  p.nodes.push(n);
  addCanvasNote(p, n.id, "subcontext").text = "Feeling";
  addCanvasNote(p, n.id, "highlight").text = "Comment";
  const [partId] = organize(p, "sections", [p.sections[0].id], "copy");
  assert.equal(p.nodes.length, 2);
  assert.equal(p.notes.length, 4);
  assert.equal(p.chapters[1].sectionId, partId);
  assert.notEqual(p.nodes[0].blocks[0].id, p.nodes[1].blocks[0].id);
  assert.equal(p.notes[2].ownerId, p.nodes[1].id);
  organize(p, "chapters", [p.chapters[0].id], "copy", partId);
  validateProject(p);
});
test("bulk reorder remains stable and blocked operations are atomic", () => {
  const p = newProject("Order");
  p.nodes.push(
    ...["A", "B", "C", "D"].map((t) => newNode(p.chapters[0].id, t)),
  );
  const ids = p.nodes.slice(1, 3).map((n) => n.id);
  organize(p, "nodes", ids, "up");
  assert.deepEqual(
    p.nodes.map((n) => n.title),
    ["B", "C", "A", "D"],
  );
  organize(p, "nodes", ids, "down");
  assert.deepEqual(
    p.nodes.map((n) => n.title),
    ["A", "B", "C", "D"],
  );
  p.nodes[2].locked = true;
  const before = clone(p);
  assert.throws(() => organize(p, "nodes", ids, "up"), /locked/);
  assert.deepEqual(p, before);
  const target = newChapter(p.sections[0].id);
  p.chapters.push(target);
  target.locked = true;
  assert.throws(
    () => organize(p, "nodes", [p.nodes[0].id], "copy", target.id),
    /locked/,
  );
});
const options: FindOptions = {
  query: "cat",
  matchCase: false,
  wholeWord: true,
  scope: "story",
};
test("literal text find supports case, whole words, individual replacement and literal dollar signs", () => {
  const p = newProject("Find");
  p.nodes.push(
    newNode(p.chapters[0].id, "Scene", "Cat cat scatter cat. café caféine"),
  );
  const hits = findMatches(p, options);
  assert.equal(hits.length, 3);
  assert.equal(findMatches(p, { ...options, matchCase: true }).length, 2);
  assert.equal(replaceMatches(p, options, "$&", hits[1].key), 1);
  assert.equal(p.nodes[0].blocks[0].text, "Cat $& scatter cat. café caféine");
  assert.equal(findMatches(p, { ...options, query: "café" }).length, 1);
  assert.equal(
    findMatches(p, { ...options, query: "$&", wholeWord: false }).length,
    1,
  );
});
test("replace skips locked, linked, and trashed nodes while including opted search scopes", () => {
  const p = newProject("Find");
  const a = newNode(p.chapters[0].id, "", "cat"),
    b = newNode(p.chapters[0].id, "", "cat");
  b.locked = true;
  p.nodes.push(a, b);
  const note = addCanvasNote(p, a.id, "highlight");
  note.text = "cat";
  const source = newNode(p.chapters[0].id, "Template", "cat");
  p.templates.push({
    id: source.id,
    name: "Reusable",
    title: source.title,
    blocks: source.blocks,
    importance: source.importance,
    liberty: source.liberty,
    beginning: source.beginning,
    ending: source.ending,
  });
  const linked = newNode(p.chapters[0].id);
  linked.blocks = [];
  linked.templateId = source.id;
  p.nodes.push(linked);
  assert.equal(findMatches(p, options).length, 3);
  assert.equal(replaceMatches(p, options, "dog"), 1);
  assert.equal(b.blocks[0].text, "cat");
  assert.equal(replaceMatches(p, { ...options, scope: "all" }, "dog"), 1);
  assert.equal(p.notes[0].text, "dog");
  assert.equal(p.templates[0].blocks[0].text, "cat");
  validateProject(p);
  p.nodes[0].trashed = true;
  assert.equal(
    findMatches(p, { ...options, query: "dog", scope: "all" }).length,
    0,
  );
});
