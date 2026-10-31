import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import {
  active,
  assertEditable,
  chapterLabel,
  clone,
  defaults,
  detach,
  duplicateProject,
  effective,
  effectiveMetadata,
  importText,
  moveItem,
  newNode,
  newProject,
  orderedNodes,
  resolvedBlocks,
  setState,
  splitText,
  uid,
  validateProject,
  updateTemplate,
} from "../apps/web/src/domain";
import {
  archiveBlob,
  hashBytes,
  publication,
  publishBlob,
  readArchive,
  safeName,
  toBase64,
  verifyAssets,
} from "../apps/web/src/export";
const fixtures = JSON.parse(readFileSync("contracts/fixtures.json", "utf8"));
const project = () => validateProject(clone(fixtures.project));

test("canvas areas preserve notes through archives and publish only opted-in context", async () => {
  const p = newProject("Canvas areas");
  p.notes.push({
    id: uid(),
    ownerId: p.id,
    canvasArea: "subcontext",
    title: "A hidden motive",
    text: "Context remains private",
    include: false,
  });
  p.notes.push({
    id: uid(),
    ownerId: p.id,
    canvasArea: "highlight",
    title: "A recurring image",
    text: "Keep the red door",
    include: true,
  });
  const output = publication(p).markdown;
  assert.ok(output.includes("### Highlight: A recurring image"));
  assert.ok(output.includes("Keep the red door"));
  assert.ok(!output.includes("Context remains private"));
  const backup = await archiveBlob(p);
  const restored = await readArchive(new File([backup.blob], "canvas.storytracks"));
  assert.deepEqual(restored.notes, p.notes);
  const copy = duplicateProject(restored);
  assert.ok(copy.notes.every((note) => note.ownerId === copy.id));
  assert.equal(copy.notes[0].canvasArea, "subcontext");
});
test("template defaults can change with locked placements but content cannot", () => {
  const p = project(),
    n = p.nodes.find((n) => n.templateId)!;
  n.locked = true;
  const t = clone(p.templates[0]);
  t.importance = 11;
  updateTemplate(p, t);
  assert.equal(n.importance, 2);
  assert.equal(p.templates[0].importance, 11);
  t.blocks[0].text = "Must not update";
  assert.throws(() => updateTemplate(p, t), /locked/);
});
test("duplication preserves authored text that happens to be a UUID", () => {
  const p = project();
  p.nodes[0].blocks[0].text = p.id;
  const q = duplicateProject(p);
  assert.equal(q.nodes[0].blocks[0].text, p.id);
});
test("shared text import fixtures preserve single breaks and normalize separators", () => {
  for (const fixture of fixtures.splits)
    assert.deepEqual(splitText(fixture.input), fixture.output);
});
test("paragraph import is ordered and uses explicit title handling", () => {
  const p = newProject("Test");
  const added = importText(p, p.chapters[0].id, "Title\nBody\n\nSecond", true);
  assert.equal(added[0].title, "Title");
  assert.equal(added[0].blocks[0].text, "Body");
  assert.equal(added[1].blocks[0].text, "");
  assert.deepEqual(
    { ...defaults },
    Object.fromEntries(
      Object.keys(defaults).map((k) => [k, (added[0] as any)[k]]),
    ),
  );
});
test("weights reject invalid and fractional half units", () => {
  for (const v of [1, 12, 6.5, NaN]) {
    const p = project();
    p.nodes[0].importance = v;
    assert.throws(() => validateProject(p));
  }
  for (const v of [2, 11]) {
    const p = project();
    p.nodes[0].importance = v;
    assert.equal(validateProject(p).nodes[0].importance, v);
  }
});
test("project schema rejects dangling owners and template content duplication", () => {
  const p = project();
  p.nodes[0].chapterId = uid();
  assert.throws(() => validateProject(p));
  const q = project();
  q.nodes[0].templateId = q.templates[0].id;
  assert.throws(() => validateProject(q));
});
test("locked ancestors protect descendants", () => {
  const p = project();
  p.sections[0].locked = true;
  assert.equal(effective(p, p.nodes[0], "locked"), true);
  assert.throws(() => assertEditable(p, p.nodes[0]));
  assert.throws(() => importText(p, p.chapters[0].id, "Text"));
});
test("parent structural changes cannot affect a locked child", () => {
  const p = project();
  p.nodes[0].locked = true;
  assert.throws(() => setState(p, p.sections[0].id, "trashed", true));
  assert.throws(() => setState(p, p.chapters[0].id, "suspended", true));
  assert.throws(() => moveItem(p, p.sections[0].id, 1));
});
test("moving nodes cannot cross locked siblings", () => {
  const p = project();
  p.nodes[1].locked = true;
  assert.throws(() => moveItem(p, p.nodes[0].id, 1));
});
test("moving into a locked chapter is blocked", () => {
  const p = project();
  p.chapters[1].locked = true;
  assert.throws(() => moveItem(p, p.nodes[0].id, 0, p.chapters[1].id));
});
test("suspension is inherited without overwriting child state", () => {
  const p = project();
  p.nodes[0].suspended = true;
  setState(p, p.sections[0].id, "suspended", true);
  assert.equal(orderedNodes(p).length, 0);
  setState(p, p.sections[0].id, "suspended", false);
  assert.equal(active(p, p.nodes[0]), false);
  assert.equal(active(p, p.nodes[1]), true);
});
test("trash excludes descendants even when suspended inclusion is requested", () => {
  const p = project();
  p.nodes[0].trashed = true;
  setState(p, p.sections[0].id, "trashed", true);
  assert.equal(orderedNodes(p, true).length, 0);
  setState(p, p.sections[0].id, "trashed", false);
  assert.equal(active(p, p.nodes[0], true), false);
  assert.equal(active(p, p.nodes[1]), true);
});
test("chapter numbering responds to suspension and manual labels", () => {
  const p = project();
  p.chapters[0].suspended = true;
  assert.equal(chapterLabel(p, p.chapters[1]), "1");
  p.chapters[1].manualLabel = "Prologue";
  assert.equal(chapterLabel(p, p.chapters[1]), "Prologue");
  assert.equal(chapterLabel(p, p.chapters[2]), "1");
});
test("template detachment preserves placement settings and copies content", () => {
  const p = project(),
    n = p.nodes.find((n) => n.templateId)!;
  const weights = { importance: n.importance, liberty: n.liberty };
  const old = resolvedBlocks(p, n);
  detach(p, n);
  assert.equal(n.templateId, undefined);
  assert.equal(n.blocks[0].text, old[0].text);
  assert.notEqual(n.blocks[0].id, old[0].id);
  assert.equal(n.importance, weights.importance);
  assert.equal(n.liberty, weights.liberty);
  validateProject(p);
});
test("linked template updates resolve at each placement independently", () => {
  const p = project(),
    n = p.nodes.find((n) => n.templateId)!;
  p.templates[0].blocks[0].text = "Changed";
  assert.equal(resolvedBlocks(p, n)[0].text, "Changed");
  assert.equal(n.liberty, 11);
});
test("explicit blank chapter guidance clears an inherited value", () => {
  const p = project();
  p.chapters[0].metadata.tone = "";
  assert.equal(effectiveMetadata(p, p.chapters[0]).tone, "");
  delete p.chapters[0].metadata.tone;
  assert.equal(effectiveMetadata(p, p.chapters[0]).tone, p.metadata.tone);
});
test("publication matches shared stable fixture and expands templates", () => {
  const p = project();
  assert.deepEqual(publication(p), fixtures.publication);
  assert.match(publication(p).markdown, /Liberty: 5.5/);
  assert.match(publication(p).markdown, /Fixture%20Book-history.md/);
  assert.match(
    publication(p).history!,
    /00:01 Speaker: Keep these words exactly/,
  );
});
test("publish filters suspended material and never includes trash", () => {
  const p = project();
  p.nodes[0].suspended = true;
  p.nodes[1].trashed = true;
  const normal = publication(p),
    all = publication(p, true);
  assert.equal(all.nodeCount, normal.nodeCount + 1);
  assert.match(all.markdown, /\[Suspended\]/);
  assert.ok(!all.markdown.includes(p.nodes[1].id));
});
test("reference and side-note inclusion are explicit and scoped", () => {
  const p = project();
  p.notes[0].include = true;
  p.nodes.find((n) => n.id === p.notes[0].ownerId)!.trashed = true;
  const out = publication(p);
  assert.ok(!out.markdown.includes(p.notes[0].text));
  assert.ok(!out.markdown.includes(p.resources[0].text));
});
test("export filename sanitizes unsafe and Windows-reserved names", () => {
  assert.equal(safeName("A/B:C?"), "A-B-C-");
  assert.equal(safeName("CON"), "_CON");
  assert.equal(safeName("..."), "Untitled");
});
test("project duplication remaps internal IDs without losing references", () => {
  const p = project(),
    q = duplicateProject(p);
  validateProject(q);
  assert.notEqual(p.id, q.id);
  assert.equal(q.nodes[0].chapterId, q.chapters[0].id);
  assert.equal(
    q.nodes.find((n) => n.templateId)!.templateId,
    q.templates[0].id,
  );
  assert.equal(q.revision, 0);
  assert.equal(q.nodes[0].blocks[0].text, p.nodes[0].blocks[0].text);
});
test("archive round trip retains templates, suspension, trash and media hashes", async () => {
  const p = project();
  const bytes = new TextEncoder().encode("reference data");
  const a = {
    id: uid(),
    filename: "source.txt",
    mediaType: "text/plain",
    size: bytes.length,
    hash: await hashBytes(bytes),
    data: toBase64(bytes),
  };
  p.assets.push(a);
  p.resources[0].assetId = a.id;
  p.nodes[0].suspended = true;
  p.nodes[1].trashed = true;
  const out = await archiveBlob(p);
  const imported = await readArchive(new File([out.blob], out.filename));
  assert.deepEqual(imported, p);
});
test("corrupt media fails export before delivering a bundle", async () => {
  const p = project();
  p.assets.push({
    id: uid(),
    filename: "bad.txt",
    mediaType: "text/plain",
    size: 2,
    hash: "0".repeat(64),
    data: "YQ==",
  });
  await assert.rejects(() => verifyAssets(p));
  await assert.rejects(() => archiveBlob(p));
});
test("archive traversal and missing manifests are rejected", async () => {
  const zip = new JSZip();
  zip.file("../escape", "bad");
  zip.file("project.json", JSON.stringify(project()));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  await assert.rejects(
    () => readArchive(new File([bytes as BlobPart], "bad.storytracks")),
    /Unsafe/,
  );
  const empty = new JSZip();
  empty.file("readme", "not a project");
  const emptyBytes = await empty.generateAsync({ type: "uint8array" });
  await assert.rejects(
    () => readArchive(new File([emptyBytes as BlobPart], "empty.storytracks")),
    /project.json/,
  );
});
test("text-only publication downloads as Markdown", async () => {
  const p = newProject("Simple");
  p.nodes.push(newNode(p.chapters[0].id, "Hello", "World"));
  const result = await publishBlob(p);
  assert.equal(result.filename, "Simple-st.md");
  assert.match(await result.blob.text(), /World/);
});
