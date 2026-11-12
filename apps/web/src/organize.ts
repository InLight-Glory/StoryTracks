import {
  Project,
  Item,
  clone,
  uid,
  active,
  assertEditable,
  moveItem,
  newChapter,
  orderedChapters,
  orderedNodes,
} from "./domain";

export type OrganizeKind = "nodes" | "chapters" | "sections";
export function selectRange(
  ids: string[],
  ordered: string[],
  anchor: string,
  target: string,
  shift: boolean,
) {
  const a = ordered.indexOf(anchor),
    b = ordered.indexOf(target);
  if (shift && a >= 0 && b >= 0)
    return [
      ...new Set([
        ...ids,
        ...ordered.slice(Math.min(a, b), Math.max(a, b) + 1),
      ]),
    ];
  return ids.includes(target)
    ? ids.filter((id) => id !== target)
    : [...ids, target];
}
export function organizeItems(p: Project, kind: OrganizeKind): Item[] {
  return kind === "nodes"
    ? orderedNodes(p, true)
    : kind === "chapters"
      ? orderedChapters(p, true)
      : p.sections.filter((s) => active(p, s, true));
}
export function organize(
  p: Project,
  kind: OrganizeKind,
  ids: string[],
  action: "move" | "copy" | "up" | "down",
  destination = "",
) {
  // Work on a draft so a blocked member cannot leave a partially moved selection.
  const d = clone(p),
    selected = organizeItems(d, kind).filter((i) => ids.includes(i.id));
  if (!selected.length || selected.length !== new Set(ids).size)
    throw new Error("Select available items first.");
  const list = d[kind] as Item[];
  const parent = (i: Item) =>
    "chapterId" in i ? i.chapterId : "sectionId" in i ? i.sectionId : "";
  if (action === "up" || action === "down") {
    const direction = action === "up" ? -1 : 1;
    for (const item of direction === 1 ? [...selected].reverse() : selected) {
      const siblings = list.filter(
        (i) => active(d, i, true) && parent(i) === parent(item),
      );
      const next = siblings[siblings.indexOf(item) + direction];
      if (next && !ids.includes(next.id)) moveItem(d, item.id, direction);
    }
    Object.assign(p, d);
    return selected.map((i) => i.id);
  }
  let target = destination;
  if (kind !== "sections") {
    const toPart = kind === "nodes" && destination.startsWith("part:");
    const targetId = toPart ? destination.slice(5) : destination;
    const owner =
      kind === "chapters" || toPart
        ? d.sections.find((s) => s.id === targetId)
        : d.chapters.find((c) => c.id === targetId);
    if (!owner || !active(d, owner, true))
      throw new Error("Choose an available destination.");
    assertEditable(d, owner);
    if (toPart) {
      const chapter = newChapter(owner.id, "");
      d.chapters.push(chapter);
      target = chapter.id;
    }
  }
  if (action === "move") {
    if (kind === "sections")
      throw new Error("Use Move up or Move down to reorder parts.");
    for (const item of selected) moveItem(d, item.id, 0, target);
    Object.assign(p, d);
    return selected.map((i) => i.id);
  }
  const copies: string[] = [];
  for (const root of selected) {
    const mapping = new Map<string, string>();
    const copy = <T extends Item>(item: T): T => {
      const result = clone(item);
      mapping.set(item.id, (result.id = uid()));
      result.locked = false;
      if ("blocks" in result) result.blocks.forEach((b) => (b.id = uid()));
      return result;
    };
    if (kind === "nodes") {
      const node = copy(d.nodes.find((n) => n.id === root.id)!);
      node.chapterId = target;
      d.nodes.push(node);
      copies.push(node.id);
    } else {
      let sectionId = target;
      if (kind === "sections") {
        const section = copy(d.sections.find((s) => s.id === root.id)!);
        section.title = `${section.title || "Untitled part"} (copy)`;
        d.sections.push(section);
        sectionId = section.id;
        copies.push(section.id);
      }
      const chapters =
        kind === "chapters"
          ? [d.chapters.find((c) => c.id === root.id)!]
          : d.chapters.filter(
              (c) => c.sectionId === root.id && active(d, c, true),
            );
      for (const chapter of chapters) {
        const c = copy(chapter);
        c.sectionId = sectionId;
        d.chapters.push(c);
        if (kind === "chapters") copies.push(c.id);
        for (const node of d.nodes.filter(
          (n) => n.chapterId === chapter.id && active(d, n, true),
        )) {
          const n = copy(node);
          n.chapterId = c.id;
          d.nodes.push(n);
        }
      }
    }
    d.notes.push(
      ...d.notes
        .filter((n) => mapping.has(n.ownerId))
        .map((n) => ({
          ...clone(n),
          id: uid(),
          ownerId: mapping.get(n.ownerId)!,
        })),
    );
    if (d.annotations)
      d.annotations.push(
        ...d.annotations
          .filter((a) => mapping.has(a.ownerId))
          .map((a) => ({ ...clone(a), ownerId: mapping.get(a.ownerId)! })),
      );
  }
  Object.assign(p, d);
  return copies;
}
