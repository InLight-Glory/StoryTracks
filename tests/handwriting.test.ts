import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  clone,
  duplicateProject,
  uid,
  validateProject,
} from "../apps/web/src/domain";
import { archiveBlob, publication, readArchive } from "../apps/web/src/export";
import { saveDrawing } from "../apps/web/src/handwriting";
import { strokeHit } from "../apps/web/src/ink";
import { organize } from "../apps/web/src/organize";
const fixture = JSON.parse(
  readFileSync("contracts/handwriting-fixtures.json", "utf8"),
);

test("handwriting publishes as a packaged image; private annotations only travel in backups", async () => {
  const p = validateProject(fixture.project);
  const result = publication(p);
  assert.equal(result.markdown, fixture.markdown);
  assert.match(result.markdown, /!\[Hand written page\]\(assets\/.+\.png\)/);
  assert.equal(result.assets.length, 1);
  assert.doesNotMatch(result.markdown, /strokes|e64662|annotations/);
  const noAnnotations = clone(p);
  delete noAnnotations.annotations;
  assert.deepEqual(publication(noAnnotations), result);
  const backup = await archiveBlob(p);
  const restored = await readArchive(new File([backup.blob], backup.filename));
  assert.deepEqual(restored.annotations, p.annotations);
  assert.deepEqual(
    restored.nodes[0].blocks[0].drawing,
    p.nodes[0].blocks[0].drawing,
  );
  const duplicate = duplicateProject(p);
  validateProject(duplicate);
  assert.equal(duplicate.annotations![0].ownerId, duplicate.chapters[0].id);
  assert.notEqual(duplicate.annotations![0].ownerId, p.annotations![0].ownerId);
});

test("editing a copied drawing preserves shared and locked images", () => {
  const p = validateProject(fixture.project);
  const [copyId] = organize(
    p,
    "nodes",
    [p.nodes[0].id],
    "copy",
    p.nodes[0].chapterId,
  );
  const original = p.nodes[0];
  original.locked = true;
  const oldAsset = clone(p.assets[0]);
  const page = clone(original.blocks[0].drawing!);
  page.strokes[0].color = "#247bcc";
  saveDrawing(p, copyId, page, { ...oldAsset, id: uid() });
  assert.deepEqual(
    p.assets.find((a) => a.id === oldAsset.id),
    oldAsset,
  );
  assert.equal(original.blocks[0].assetId, oldAsset.id);
  assert.notEqual(
    p.nodes.find((n) => n.id === copyId)!.blocks[0].assetId,
    oldAsset.id,
  );
  assert.throws(
    () => saveDrawing(p, original.id, page, { ...oldAsset, id: uid() }),
    /locked/i,
  );
  validateProject(p);
});

test("drawing validation rejects malformed ink and orphaned/duplicate annotation scopes", () => {
  for (const alter of [
    (p: any) => p.nodes[0].blocks[0].drawing.strokes[0].points.push([1001, 20]),
    (p: any) => (p.nodes[0].blocks[0].drawing.strokes[0].width = -1),
    (p: any) => (p.nodes[0].blocks[0].drawing.strokes[0].color = "url(evil)"),
    (p: any) => (p.annotations[0].ownerId = uid()),
    (p: any) => p.annotations.push(clone(p.annotations[0])),
  ]) {
    const p = clone(fixture.project);
    alter(p);
    assert.throws(() => validateProject(p));
  }
  const p = validateProject(fixture.project);
  const stroke = p.nodes[0].blocks[0].drawing!.strokes[0];
  assert.equal(strokeHit(stroke, [150, 140]), true);
  assert.equal(strokeHit(stroke, [700, 700]), false);
});
