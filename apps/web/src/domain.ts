import { z } from "zod";

export const uid = () => crypto.randomUUID();
const id = z.string().uuid();
const state = {
  locked: z.boolean(),
  suspended: z.boolean(),
  trashed: z.boolean(),
};
const weights = {
  importance: z.number().int().min(2).max(11),
  liberty: z.number().int().min(2).max(11),
  beginning: z.number().int().min(0).max(100),
  ending: z.number().int().min(0).max(100),
};
export const defaults = {
  importance: 6,
  liberty: 2,
  beginning: 50,
  ending: 50,
};
export const metadataFields = [
  "author",
  "genre",
  "audience",
  "language",
  "style",
  "tone",
  "mood",
  "pov",
  "tense",
  "pacing",
  "targetLength",
  "instructions",
] as const;
export const metadataLabels: Record<string, string> = {
  author: "Author",
  genre: "Genre",
  audience: "Intended audience",
  language: "Language",
  style: "Writing style",
  tone: "Tone",
  mood: "Mood",
  pov: "Point of view",
  tense: "Tense",
  pacing: "Pacing",
  targetLength: "Target length",
  instructions: "Writing instructions",
};
export const blockSchema = z.object({
  id,
  type: z.enum(["text", "image", "audio"]),
  text: z.string().default(""),
  assetId: id.optional(),
  caption: z.string().default(""),
  alt: z.string().default(""),
});
export const nodeSchema = z.object({
  id,
  chapterId: id,
  title: z.string(),
  kind: z.enum(["beat", "scene", "note", "turn"]).default("beat"),
  blocks: z.array(blockSchema),
  templateId: id.optional(),
  ...state,
  ...weights,
});
export const projectSchema = z.object({
  schemaVersion: z.literal(1),
  id,
  revision: z.number().int().nonnegative(),
  name: z.string().min(1).max(200),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.string(), z.string()),
  workbook: z
    .object({
      templateId: z.string(),
      prompts: z.array(
        z.object({
          id,
          category: z.string(),
          question: z.string(),
          answer: z.string(),
          include: z.boolean(),
        }),
      ),
      world: z.array(
        z.object({
          id,
          category: z.string(),
          title: z.string(),
          description: z.string(),
          include: z.boolean(),
        }),
      ),
      questions: z.array(
        z.object({
          id,
          statement: z.string(),
          source: z.string(),
          candidates: z.array(z.string()).max(12),
          question: z.string(),
          insight: z.string(),
          alternatives: z.string(),
          audience: z.string(),
          hook: z.string(),
          include: z.boolean(),
        }),
      ),
    })
    .optional(),
  sections: z.array(z.object({ id, title: z.string(), ...state })),
  chapters: z.array(
    z.object({
      id,
      sectionId: id,
      title: z.string(),
      manualLabel: z.string().nullable(),
      metadata: z.record(z.string(), z.string()),
      ...state,
    }),
  ),
  nodes: z.array(nodeSchema),
  templates: z.array(
    z.object({
      id,
      name: z.string(),
      title: z.string(),
      blocks: z.array(blockSchema),
      description: z.string().optional(),
      ...weights,
    }),
  ),
  notes: z.array(
    z.object({
      id,
      ownerId: id,
      text: z.string(),
      include: z.boolean(),
      canvasArea: z.enum(["subcontext", "highlight"]).optional(),
      title: z.string().optional(),
    }),
  ),
  resources: z.array(
    z.object({
      id,
      title: z.string(),
      kind: z.enum(["historical_transcript", "reference"]),
      text: z.string(),
      source: z.string(),
      createdAt: z.string(),
      include: z.boolean(),
      assetId: id.optional(),
    }),
  ),
  assets: z.array(
    z.object({
      id,
      filename: z.string(),
      mediaType: z.string(),
      data: z.string(),
      hash: z.string().regex(/^[a-f0-9]{64}$/),
      size: z.number().int().nonnegative(),
    }),
  ),
});
export type Project = z.infer<typeof projectSchema>;
export type StoryNode = Project["nodes"][number];
export type Block = z.infer<typeof blockSchema>;
export type Chapter = Project["chapters"][number];
export type Section = Project["sections"][number];
export type Item = StoryNode | Chapter | Section;
export const clone = <T>(v: T): T => structuredClone(v);
export function textBlock(text = ""): Block {
  return { id: uid(), type: "text", text, caption: "", alt: "" };
}
export function newNode(chapterId: string, title = "", text = ""): StoryNode {
  return {
    id: uid(),
    chapterId,
    title,
    blocks: [textBlock(text)],
    kind: "beat",
    locked: false,
    suspended: false,
    trashed: false,
    ...defaults,
  };
}
export function newChapter(
  sectionId: string,
  title = "Untitled chapter",
): Chapter {
  return {
    id: uid(),
    sectionId,
    title,
    manualLabel: null,
    metadata: {},
    locked: false,
    suspended: false,
    trashed: false,
  };
}
export function newSection(title = "Untitled section"): Section {
  return { id: uid(), title, locked: false, suspended: false, trashed: false };
}
export function newProject(name: string, description = ""): Project {
  const section = newSection("Part one");
  const chapter = newChapter(section.id, "Chapter one");
  return {
    schemaVersion: 1,
    id: uid(),
    revision: 0,
    name: name.trim() || "Untitled project",
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { language: "English" },
    sections: [section],
    chapters: [chapter],
    nodes: [],
    templates: [],
    notes: [],
    resources: [],
    assets: [],
  };
}
export function getItem(p: Project, itemId: string): Item | undefined {
  // Parent lookups usually end in the small section/chapter lists. Avoid
  // allocating a copy of the entire book for every inherited state check.
  return (
    p.sections.find((i) => i.id === itemId) ||
    p.chapters.find((i) => i.id === itemId) ||
    p.nodes.find((i) => i.id === itemId)
  );
}
export function ancestors(p: Project, item: Item): Item[] {
  const parentId =
    "chapterId" in item
      ? item.chapterId
      : "sectionId" in item
        ? item.sectionId
        : undefined;
  const parent = parentId ? getItem(p, parentId) : undefined;
  return parent ? [parent, ...ancestors(p, parent)] : [];
}
export function effective(
  p: Project,
  item: Item,
  field: "locked" | "suspended" | "trashed",
) {
  return item[field] || ancestors(p, item).some((i) => i[field]);
}
export function active(p: Project, item: Item, suspended = false) {
  return (
    !effective(p, item, "trashed") &&
    (suspended || !effective(p, item, "suspended"))
  );
}
export function assertEditable(p: Project, item: Item, structure = false) {
  if (effective(p, item, "locked"))
    throw new Error("This item is locked. Unlock it or its parent first.");
  if (
    structure &&
    [...p.chapters, ...p.nodes].some(
      (i) => ancestors(p, i).some((a) => a.id === item.id) && i.locked,
    )
  )
    throw new Error("A locked item inside this group prevents this action.");
}
export function resolvedBlocks(p: Project, n: StoryNode): Block[] {
  return n.templateId
    ? p.templates.find((t) => t.id === n.templateId)!.blocks
    : n.blocks;
}
export function nodeTitle(p: Project, n: StoryNode) {
  return (
    (n.templateId
      ? p.templates.find((t) => t.id === n.templateId)?.title
      : n.title) ||
    resolvedBlocks(p, n)
      .find((b) => b.type === "text")
      ?.text.split("\n")[0]
      .slice(0, 60) ||
    "Untitled node"
  );
}
export function orderedChapters(p: Project, showSuspended = false) {
  return p.sections
    .filter((s) => active(p, s, showSuspended))
    .flatMap((s) =>
      p.chapters.filter(
        (c) => c.sectionId === s.id && active(p, c, showSuspended),
      ),
    );
}
export function orderedNodes(p: Project, showSuspended = false) {
  return orderedChapters(p, showSuspended).flatMap((c) =>
    p.nodes.filter((n) => n.chapterId === c.id && active(p, n, showSuspended)),
  );
}
export function chapterLabel(p: Project, c: Chapter) {
  return (
    c.manualLabel ??
    String(
      orderedChapters(p)
        .filter((x) => x.manualLabel === null)
        .findIndex((x) => x.id === c.id) + 1 || "—",
    )
  );
}
export function effectiveMetadata(p: Project, c: Chapter) {
  return { ...p.metadata, ...c.metadata };
}
export function splitText(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n[\t ]*\n(?:[\t ]*\n)*/)
    .map((s) => s.trim())
    .filter(Boolean);
}
export function importText(
  p: Project,
  chapterId: string,
  text: string,
  firstLineTitle = false,
) {
  const chapter = p.chapters.find((c) => c.id === chapterId);
  if (!chapter) throw new Error("Choose a chapter.");
  assertEditable(p, chapter);
  const nodes = splitText(text).map((t) => {
    const lines = t.split("\n");
    return newNode(
      chapterId,
      firstLineTitle ? lines.shift()! : "",
      firstLineTitle ? lines.join("\n") : t,
    );
  });
  if (!nodes.length) throw new Error("Add some text to import.");
  p.nodes.push(...nodes);
  return nodes;
}
export function moveItem(
  p: Project,
  itemId: string,
  direction: number,
  targetParent?: string,
) {
  const item = getItem(p, itemId);
  if (!item) throw new Error("Item not found.");
  assertEditable(p, item, true);
  const list: Item[] =
    "chapterId" in item
      ? p.nodes
      : "sectionId" in item
        ? p.chapters
        : p.sections;
  const parentKey =
    "chapterId" in item
      ? "chapterId"
      : "sectionId" in item
        ? "sectionId"
        : null;
  if (targetParent && parentKey) {
    const parent = getItem(p, targetParent);
    if (
      !parent ||
      (parentKey === "chapterId"
        ? !("sectionId" in parent)
        : "sectionId" in parent || "chapterId" in parent)
    )
      throw new Error("Invalid destination.");
    assertEditable(p, parent);
    if (effective(p, parent, "trashed"))
      throw new Error("Restore the destination first.");
    // Leaving a sibling group must not cross a locked boundary.
    const siblings = list.filter(
      (x) => (x as any)[parentKey] === (item as any)[parentKey],
    );
    if (siblings.some((x) => x.id !== itemId && effective(p, x, "locked")))
      throw new Error("A locked sibling prevents moving out of this group.");
    (item as any)[parentKey] = targetParent;
    list.splice(list.indexOf(item), 1);
    list.push(item);
    return;
  }
  const siblings = list.filter(
    (x) =>
      !x.trashed &&
      (!parentKey || (x as any)[parentKey] === (item as any)[parentKey]),
  );
  const index = siblings.indexOf(item),
    other = siblings[index + direction];
  if (!other) return;
  assertEditable(p, other, true);
  const a = list.indexOf(item),
    b = list.indexOf(other);
  [list[a], list[b]] = [list[b], list[a]];
}
export function setState(
  p: Project,
  itemId: string,
  field: "locked" | "suspended" | "trashed",
  value: boolean,
) {
  const item = getItem(p, itemId);
  if (!item) return;
  if (field === "locked" && !value) {
    if (ancestors(p, item).some((a) => a.locked))
      throw new Error("Unlock the parent first.");
  } else assertEditable(p, item, field !== "locked");
  item[field] = value;
}
export function detach(p: Project, n: StoryNode) {
  assertEditable(p, n);
  if (n.templateId) {
    n.blocks = clone(resolvedBlocks(p, n)).map((b) => ({ ...b, id: uid() }));
    n.title = p.templates.find((t) => t.id === n.templateId)!.title;
    delete n.templateId;
  }
}
export function updateTemplate(
  p: Project,
  value: Project["templates"][number],
) {
  const old = p.templates.find((t) => t.id === value.id);
  if (old) {
    if (
      old.title !== value.title ||
      JSON.stringify(old.blocks) !== JSON.stringify(value.blocks)
    )
      p.nodes
        .filter((n) => n.templateId === value.id)
        .forEach((n) => assertEditable(p, n));
    Object.assign(old, clone(value));
  } else p.templates.push(clone(value));
}
export function addCanvasNote(
  p: Project,
  nodeId: string,
  area: "subcontext" | "highlight",
) {
  const node = p.nodes.find((n) => n.id === nodeId);
  if (!node || effective(p, node, "trashed"))
    throw new Error("Select a node on the canvas first.");
  assertEditable(p, node);
  const note = {
    id: uid(),
    ownerId: nodeId,
    canvasArea: area,
    title: "",
    text: "",
    include: false,
  };
  p.notes.push(note);
  return note;
}
export function editCanvasNote(
  p: Project,
  noteId: string,
  patch: Partial<Project["notes"][number]> | null,
) {
  const note = p.notes.find((n) => n.id === noteId);
  if (!note?.canvasArea) throw new Error("Canvas note not found.");
  const previous = getItem(p, note.ownerId);
  if (previous) assertEditable(p, previous);
  if (patch?.ownerId && patch.ownerId !== p.id) {
    const next = p.nodes.find((n) => n.id === patch.ownerId);
    if (!next || effective(p, next, "trashed"))
      throw new Error("Choose an available node.");
    assertEditable(p, next);
  }
  if (patch === null) p.notes = p.notes.filter((n) => n.id !== noteId);
  else Object.assign(note, patch);
}
export function duplicateProject(p: Project) {
  const copy = clone(p),
    ids = new Map<string, string>();
  const replace = (value: unknown, key = ""): any => {
    if (
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) &&
      [
        "id",
        "chapterId",
        "sectionId",
        "templateId",
        "assetId",
        "ownerId",
      ].includes(key)
    ) {
      if (!ids.has(value)) ids.set(value, uid());
      return ids.get(value);
    }
    if (Array.isArray(value)) return value.map((v) => replace(v));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, replace(v, k)]),
      );
    return value;
  };
  const result = replace(copy) as Project;
  result.revision = 0;
  result.name += " (copy)";
  result.createdAt = result.updatedAt = new Date().toISOString();
  return result;
}
export function validateProject(input: unknown): Project {
  const p = projectSchema.parse(input);
  const mediaTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/webm",
    "application/pdf",
    "text/plain",
    "text/markdown",
  ];
  for (const a of p.assets)
    if (!mediaTypes.includes(a.mediaType) || a.size > 25 * 1024 * 1024)
      throw new Error("Unsupported attachment type or size.");
  if (p.assets.reduce((sum, a) => sum + a.size, 0) > 100 * 1024 * 1024)
    throw new Error("Project attachments exceed the 100 MB limit.");
  const seen = new Set<string>();
  for (const i of [
    p,
    ...p.sections,
    ...p.chapters,
    ...p.nodes,
    ...p.templates,
    ...p.notes,
    ...p.resources,
    ...p.assets,
    ...(p.workbook
      ? [...p.workbook.prompts, ...p.workbook.world, ...p.workbook.questions]
      : []),
    ...p.nodes.flatMap((n) => n.blocks),
    ...p.templates.flatMap((t) => t.blocks),
  ]) {
    if (seen.has(i.id)) throw new Error("Duplicate ID in project.");
    seen.add(i.id);
  }
  for (const c of p.chapters)
    if (!p.sections.some((s) => s.id === c.sectionId))
      throw new Error("Chapter has no section.");
  for (const n of p.nodes) {
    if (!p.chapters.some((c) => c.id === n.chapterId))
      throw new Error("Node has no chapter.");
    if (
      n.templateId &&
      (!p.templates.some((t) => t.id === n.templateId) || n.blocks.length)
    )
      throw new Error("Invalid template placement.");
  }
  for (const b of [
    ...p.nodes.flatMap((n) => n.blocks),
    ...p.templates.flatMap((t) => t.blocks),
  ]) {
    if (
      b.type !== "text" &&
      !p.assets.some(
        (a) => a.id === b.assetId && a.mediaType.startsWith(b.type + "/"),
      )
    )
      throw new Error("Missing or incompatible media.");
  }
  for (const r of p.resources)
    if (r.assetId && !p.assets.some((a) => a.id === r.assetId))
      throw new Error("Resource attachment is missing.");
  for (const n of p.notes) {
    if (n.ownerId !== p.id && !getItem(p, n.ownerId))
      throw new Error("Note owner is missing.");
    if (
      n.canvasArea &&
      n.ownerId !== p.id &&
      !p.nodes.some((node) => node.id === n.ownerId)
    )
      throw new Error("Canvas notes must connect to a node.");
  }
  return p;
}

export function demoProject(): Project {
  const p = newProject(
    "The Cartographer’s Daughter",
    "Some places can only be found by getting lost.",
  );
  p.metadata = {
    author: "Eleanor Hayes",
    genre: "Literary mystery",
    audience: "Adult",
    language: "English",
    style: "Atmospheric, intimate, quietly lyrical",
    tone: "Reflective",
    mood: "Quiet unease",
    pov: "Third person, limited",
    tense: "Past",
    pacing: "Moderate",
    targetLength: "80,000 words",
    instructions: "Let the landscape carry what the characters cannot say.",
  };
  p.sections[0].title = "The return";
  const second = newSection("The uncharted");
  const third = newSection("A way home");
  p.sections.push(second, third);
  p.chapters[0].title = "A town that remembers";
  p.chapters[0].metadata = {
    mood: "Nostalgic, with an undercurrent of unease",
    pacing: "Slow",
  };
  p.chapters.push(
    newChapter(p.sections[0].id, "The room above the shop"),
    newChapter(p.sections[0].id, "Lines that lead nowhere"),
    newChapter(second.id, "Beyond the river"),
    newChapter(second.id, "An unfinished map"),
    newChapter(third.id, "What we choose to keep"),
  );
  const first = p.chapters[0].id;
  p.nodes.push(
    newNode(
      first,
      "The last train to Bellwether",
      "After twelve years away, Mara steps onto the platform with one suitcase and a letter she has not opened.\n\nThe station clock is still seven minutes slow. Some things, she thinks, have learned how to stay.",
    ),
  );
  p.nodes[0].kind = "scene";
  p.nodes[0].importance = 9;
  p.nodes.push(
    newNode(
      first,
      "A familiar stranger",
      "The man at the ticket window knows her name. He asks if she has come for the shop.\n\nShe has come for her father. She does not correct him.",
    ),
  );
  p.nodes[1].kind = "beat";
  p.nodes[1].liberty = 5;
  p.nodes.push(
    newNode(
      first,
      "The map in the window",
      "Her father’s shop is exactly as she remembers, except for the map in the window: a careful rendering of Bellwether with a street that does not exist.",
    ),
  );
  p.nodes[2].kind = "turn";
  p.nodes[2].importance = 11;
  p.nodes[2].ending = 80;
  p.nodes.push(
    newNode(
      first,
      "A key, and a question",
      "Under the familiar loose stone, a brass key waits in an envelope. On the envelope, in her father’s handwriting: “Which way is home?”",
    ),
  );
  p.nodes[3].kind = "scene";
  p.nodes.push(
    newNode(
      p.chapters[1].id,
      "Everything in its place",
      "The room smells of paper, cedar, and the sea. Every drawer is labeled. One is empty.",
    ),
  );
  p.nodes.push(
    newNode(
      p.chapters[2].id,
      "An impossible address",
      "Mara walks to the street on the map. The road ends at the water.",
    ),
  );
  p.notes.push(
    {
      id: uid(),
      ownerId: p.nodes[2].id,
      text: "The impossible street is the first real fracture in the familiar. Keep it small. No explanation yet.",
      include: false,
    },
    {
      id: uid(),
      ownerId: p.id,
      text: "Recurring motifs: maps, inherited silences, the unreliable comfort of familiar places.",
      include: false,
    },
  );
  p.templates.push({
    id: uid(),
    name: "The question of home",
    title: "Which way is home?",
    blocks: [textBlock("“Which way is home?”")],
    ...defaults,
  });
  p.resources.push({
    id: uid(),
    title: "A note on Bellwether",
    kind: "reference",
    text: "A fictional coastal town. Once a harbor for survey ships; now a place people pass through. The sea is always audible, never quite visible.",
    source: "World-building notes",
    createdAt: p.createdAt,
    include: false,
  });
  return p;
}
