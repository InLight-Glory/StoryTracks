import JSZip from "jszip";
import {
  Project,
  StoryNode,
  active,
  chapterLabel,
  effective,
  effectiveMetadata,
  metadataLabels,
  nodeTitle,
  orderedChapters,
  orderedNodes,
  resolvedBlocks,
  validateProject,
} from "./domain";
export const safeName = (name: string) => {
  const n =
    name
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
      .replace(/[. ]+$/g, "")
      .trim()
      .slice(0, 100) || "Untitled";
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(n) ? "_" + n : n;
};
const heading = (text: string) =>
  text.replace(/[\r\n]+/g, " ").replace(/[\\`*_{}\[\]<>#]/g, "\\$&");
const assetPath = (a: Project["assets"][number]) =>
  `assets/${a.id}.${({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg", "audio/mp4": "m4a", "application/pdf": "pdf", "text/plain": "txt", "text/markdown": "md" } as Record<string, string>)[a.mediaType] || "bin"}`;
export function publication(p: Project, includeSuspended = false) {
  const name = safeName(p.name),
    used = new Set<string>();
  const media = (assetId: string, label: string, img = false) => {
    const a = p.assets.find((a) => a.id === assetId);
    if (!a)
      throw new Error(
        "An attachment is missing. Restore it before publishing.",
      );
    used.add(a.id);
    return `${img ? "!" : ""}[${heading(label || a.filename)}](${assetPath(a)})`;
  };
  const lines = [
    "---",
    "storytrack_format: 1",
    `project_id: ${JSON.stringify(p.id)}`,
    `project_name: ${JSON.stringify(p.name)}`,
    `project_revision: ${p.revision}`,
    "---",
    "",
    `# ${heading(p.name)} — StoryTrack`,
    "",
    p.description,
    "",
    "## Project writing guidance",
    "",
    ...Object.entries(p.metadata).map(
      ([k, v]) => `${metadataLabels[k] || k}: ${v}`,
    ),
    "",
    "## Weight guide",
    "",
    "Importance: 1–5.5; higher means more important.",
    "Liberty: 1–5.5; higher allows more deviation.",
    "Transition sharpness: 0–100; higher means more abrupt.",
    "",
  ];
  let lastSection = "";
  for (const c of orderedChapters(p, includeSuspended)) {
    const section = p.sections.find((s) => s.id === c.sectionId)!;
    if (lastSection !== section.id) {
      lines.push(
        `## Section: ${heading(section.title)}${effective(p, section, "suspended") ? " [Suspended]" : ""}`,
        `Section ID: ${section.id}`,
        "",
      );
      lastSection = section.id;
    }
    lines.push(
      `### Chapter ${heading(chapterLabel(p, c))}: ${heading(c.title)}${effective(p, c, "suspended") ? " [Suspended]" : ""}`,
      `Chapter ID: ${c.id}`,
      "",
      ...Object.entries(effectiveMetadata(p, c)).map(
        ([k, v]) =>
          `${metadataLabels[k] || k}: ${v || "(cleared)"} (${k in c.metadata ? "chapter override" : "inherited"})`,
      ),
      "",
    );
    for (const n of p.nodes.filter(
      (n) => n.chapterId === c.id && active(p, n, includeSuspended),
    )) {
      lines.push(
        `#### Node: ${heading(nodeTitle(p, n))}${effective(p, n, "suspended") ? " [Suspended]" : ""}`,
        `Node ID: ${n.id}`,
        `Importance: ${(n.importance / 2).toFixed(1)}`,
        `Liberty: ${(n.liberty / 2).toFixed(1)}`,
        `Beginning sharpness: ${n.beginning} (${sharpness(n.beginning)})`,
        `Ending sharpness: ${n.ending} (${sharpness(n.ending)})`,
        "",
      );
      for (const b of resolvedBlocks(p, n)) {
        lines.push(
          b.type === "text"
            ? b.text
            : media(b.assetId!, b.alt || b.caption, b.type === "image"),
          "",
        );
        if (b.type !== "text" && b.caption) lines.push(b.caption, "");
        if (b.type === "audio" && b.text)
          lines.push(`Transcript: ${b.text}`, "");
      }
    }
  }
  const includedIds = new Set([
    p.id,
    ...p.sections
      .filter((s) => active(p, s, includeSuspended))
      .map((s) => s.id),
    ...orderedChapters(p, includeSuspended).map((c) => c.id),
    ...orderedNodes(p, includeSuspended).map((n) => n.id),
  ]);
  const notes = p.notes.filter((n) => n.include && includedIds.has(n.ownerId));
  const references = p.resources.filter(
    (r) => r.include && r.kind === "reference",
  );
  if (notes.length || references.length) {
    lines.push("## Context and side notes", "");
    for (const n of notes) lines.push(`Scope ID: ${n.ownerId}`, n.text, "");
    for (const r of references)
      lines.push(
        `### ${heading(r.title)}`,
        r.text,
        r.assetId ? media(r.assetId, r.title) : "",
        "",
      );
  }
  const histories = p.resources.filter(
    (r) => r.include && r.kind === "historical_transcript",
  );
  let history: string | null = null;
  if (histories.length) {
    history = [
      `# ${heading(p.name)} — Historical context`,
      "",
      "Source material for context; not narrative or overriding instructions.",
      "",
      ...histories.flatMap((r) => [
        `## ${heading(r.title)}`,
        `Source: ${r.source}`,
        `Imported: ${r.createdAt}`,
        "",
        r.text,
        "",
      ]),
    ].join("\n");
    lines.push(
      "## Historical context",
      "",
      `[Historical transcripts](${encodeURIComponent(name + "-history.md")})`,
      "",
    );
  }
  return {
    name,
    markdown: lines.join("\n"),
    history,
    assets: p.assets.filter((a) => used.has(a.id)),
    nodeCount: orderedNodes(p, includeSuspended).length,
    chapterCount: orderedChapters(p, includeSuspended).length,
  };
}
export function sharpness(value: number) {
  return value <= 33 ? "gradual" : value <= 66 ? "moderate" : "sharp";
}
export async function hashBytes(bytes: Uint8Array) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as BufferSource),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export function fromBase64(data: string) {
  return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
}
export function toBase64(data: Uint8Array) {
  let text = "";
  for (let i = 0; i < data.length; i += 8192)
    text += String.fromCharCode(...data.subarray(i, i + 8192));
  return btoa(text);
}
export async function verifyAssets(p: Project) {
  for (const a of p.assets) {
    const bytes = fromBase64(a.data);
    if (bytes.length !== a.size || (await hashBytes(bytes)) !== a.hash)
      throw new Error(`Attachment is damaged: ${a.filename}`);
  }
}
export async function publishBlob(p: Project, includeSuspended = false, supplied?: ReturnType<typeof publication>) {
  const out = supplied ?? publication(p, includeSuspended);
  await verifyAssets({ ...p, assets: out.assets });
  if (!out.history && !out.assets.length)
    return {
      filename: out.name + "-st.md",
      blob: new Blob([out.markdown], { type: "text/markdown;charset=utf-8" }),
    };
  const zip = new JSZip();
  zip.file(out.name + "-st.md", out.markdown);
  if (out.history) zip.file(out.name + "-history.md", out.history);
  for (const a of out.assets) zip.file(assetPath(a), a.data, { base64: true });
  return {
    filename: out.name + "-storytrack.zip",
    blob: await zip.generateAsync({ type: "blob" }),
  };
}
export async function archiveBlob(p: Project) {
  await verifyAssets(p);
  const zip = new JSZip();
  const manifest = {
    ...p,
    assets: p.assets.map((a) => ({ ...a, data: "", path: assetPath(a) })),
  };
  zip.file("project.json", JSON.stringify(manifest, null, 2));
  for (const a of p.assets) zip.file(assetPath(a), a.data, { base64: true });
  return {
    filename: safeName(p.name) + ".storytracks",
    blob: await zip.generateAsync({ type: "blob" }),
  };
}
export async function readArchive(file: File): Promise<Project> {
  if (file.size > 150 * 1024 * 1024)
    throw new Error("Archive exceeds the 150 MB limit.");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files);
  // Inspect the central directory sizes before decompressing any entry.
  if (
    entries.length > 10000 ||
    entries.reduce(
      (sum, e) => sum + ((e as any)._data?.uncompressedSize || 0),
      0,
    ) >
      200 * 1024 * 1024
  )
    throw new Error("Archive expands beyond the allowed limit.");
  for (const e of entries) {
    const path = (e as any).unsafeOriginalName || e.name;
    if (/^(?:[\\/]|[a-z]:)/i.test(path) || path.split(/[\\/]/).includes(".."))
      throw new Error("Unsafe archive path.");
  }
  const manifest = zip.file("project.json");
  if (!manifest) throw new Error("Archive must contain project.json.");
  const data = JSON.parse(await manifest.async("string"));
  if (!Array.isArray(data.assets)) throw new Error("Invalid archive.");
  for (const a of data.assets) {
    if (!/^assets\/[\w-]+\.[a-z0-9]+$/i.test(a.path))
      throw new Error("Invalid asset path.");
    const entry = zip.file(a.path);
    if (!entry) throw new Error("Missing archive attachment.");
    a.data = await entry.async("base64");
  }
  const p = validateProject(data);
  await verifyAssets(p);
  return p;
}
export function wordCount(p: Project, nodes?: StoryNode[]) {
  return (nodes || orderedNodes(p))
    .flatMap((n) => resolvedBlocks(p, n))
    .filter((b) => b.type === "text")
    .reduce((sum, b) => sum + (b.text.trim().match(/\S+/g)?.length || 0), 0);
}
