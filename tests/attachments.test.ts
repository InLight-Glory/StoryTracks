import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attachmentType,
  textAttachment,
  attachmentDownload,
} from "../apps/web/src/attachments";
import { hashBytes, toBase64 } from "../apps/web/src/export";
import { uid } from "../apps/web/src/domain";

test("local files with missing or generic MIME types retain the correct supported type", () => {
  assert.equal(
    attachmentType({ name: "Notes.TXT", type: "" }, true),
    "text/plain",
  );
  assert.equal(
    attachmentType(
      { name: "notes.md", type: "application/octet-stream" },
      true,
    ),
    "text/markdown",
  );
  assert.equal(
    attachmentType({ name: "notes.md", type: "text/plain" }, true),
    "text/markdown",
  );
  assert.throws(
    () => attachmentType({ name: "notes.txt", type: "" }, false),
    /Resources/,
  );
  assert.throws(
    () =>
      attachmentType(
        { name: "program.exe", type: "application/octet-stream" },
        true,
      ),
    /Use/,
  );
});
test("text resources decode common Windows encodings without changing their original attachment bytes", () => {
  assert.equal(
    textAttachment(new TextEncoder().encode("A café\r\nSecond line")),
    "A café\r\nSecond line",
  );
  assert.equal(textAttachment(new Uint8Array([255, 254, 72, 0, 105, 0])), "Hi");
  assert.equal(textAttachment(new Uint8Array([254, 255, 0, 72, 0, 105])), "Hi");
  assert.equal(textAttachment(new Uint8Array([0x93, 72, 105, 0x94])), "“Hi”");
});
test("attachment download builds an exact blob from saved bytes and rejects corruption", async () => {
  const bytes = new TextEncoder().encode("Original\r\nText — café");
  const asset = {
    id: uid(),
    filename: "source.txt",
    mediaType: "text/plain",
    data: toBase64(bytes),
    size: bytes.length,
    hash: await hashBytes(bytes),
  };
  const result = await attachmentDownload(asset);
  assert.equal(result.filename, "source.txt");
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), bytes);
  await assert.rejects(
    () => attachmentDownload({ ...asset, size: 1 }),
    /damaged/,
  );
});
