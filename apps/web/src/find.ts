import {
  Project,
  effective,
  resolvedBlocks,
  nodeTitle,
  getItem,
  active,
} from "./domain";

export type FindOptions = {
  query: string;
  matchCase: boolean;
  wholeWord: boolean;
  scope: "story" | "all";
  within?: string;
};
export type TextField = {
  path: (string | number)[];
  text: string;
  label: string;
  nodeId?: string;
  readonly: boolean;
};
export type Match = TextField & { start: number; end: number; key: string };
export function textFields(
  p: Project,
  scope: FindOptions["scope"],
): TextField[] {
  const fields: TextField[] = [];
  const add = (
    path: TextField["path"],
    text: string,
    label: string,
    readonly = false,
    nodeId?: string,
  ) => fields.push({ path, text, label, readonly, nodeId });
  p.sections.forEach((s, i) => {
    if (active(p, s, true))
      add(
        ["sections", i, "title"],
        s.title,
        "Part title",
        effective(p, s, "locked"),
      );
  });
  p.chapters.forEach((c, i) => {
    if (active(p, c, true))
      add(
        ["chapters", i, "title"],
        c.title,
        "Chapter title",
        effective(p, c, "locked"),
      );
  });
  p.nodes.forEach((n, i) => {
    if (!active(p, n, true)) return;
    const readonly = effective(p, n, "locked") || !!n.templateId;
    const title = n.templateId
      ? p.templates.find((t) => t.id === n.templateId)!.title
      : n.title;
    add(
      ["nodes", i, "title"],
      title,
      `${nodeTitle(p, n)} · title`,
      readonly,
      n.id,
    );
    resolvedBlocks(p, n).forEach((b, j) =>
      (["text", "caption", "alt"] as const).forEach((key) =>
        add(
          ["nodes", i, "blocks", j, key],
          b[key],
          `${nodeTitle(p, n)} · ${key}`,
          readonly,
          n.id,
        ),
      ),
    );
  });
  if (scope === "all") {
    add(["description"], p.description, "Project description");
    p.notes.forEach((n, i) => {
      const owner = getItem(p, n.ownerId);
      if (owner && !active(p, owner, true)) return;
      for (const key of ["text", "title"] as const)
        if (n[key] !== undefined)
          add(
            ["notes", i, key],
            n[key]!,
            `${n.canvasArea || "Note"} · ${key}`,
            !!owner && effective(p, owner, "locked"),
            p.nodes.some((x) => x.id === n.ownerId) ? n.ownerId : undefined,
          );
    });
    p.resources.forEach((r, i) =>
      (["title", "text", "source"] as const).forEach((key) =>
        add(["resources", i, key], r[key], `Resource · ${key}`),
      ),
    );
    if (p.workbook) {
      for (const group of ["prompts", "world", "questions"] as const)
        p.workbook[group].forEach((entry, i) => {
          for (const [key, value] of Object.entries(entry))
            if (typeof value === "string" && !["id", "category"].includes(key))
              add(["workbook", group, i, key], value, `${group} · ${key}`);
        });
    }
  }
  return fields;
}
export function findMatches(p: Project, options: FindOptions): Match[] {
  if (!options.query) return [];
  const escaped = options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    options.wholeWord
      ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`
      : escaped,
    options.matchCase ? "gu" : "giu",
  );
  return textFields(p, options.scope)
    .filter((field) => {
      if (!options.within) return true;
      const [group, index] = field.path;
      const item =
        group === "nodes"
          ? p.nodes[index as number]
          : group === "chapters"
            ? p.chapters[index as number]
            : group === "sections"
              ? p.sections[index as number]
              : group === "notes"
                ? getItem(p, p.notes[index as number].ownerId)
                : undefined;
      if (!item) return false;
      if (item.id === options.within) return true;
      if ("chapterId" in item) {
        if (item.chapterId === options.within) return true;
        return (
          p.chapters.find((c) => c.id === item.chapterId)?.sectionId ===
          options.within
        );
      }
      return "sectionId" in item && item.sectionId === options.within;
    })
    .flatMap((field) =>
      [...field.text.matchAll(regex)].map((m) => ({
        ...field,
        start: m.index!,
        end: m.index! + m[0].length,
        key: JSON.stringify(field.path) + ":" + m.index,
      })),
    );
}
export function replaceMatches(
  p: Project,
  options: FindOptions,
  replacement: string,
  key?: string,
) {
  const matches = findMatches(p, options).filter(
    (m) => !m.readonly && (!key || m.key === key),
  );
  const groups = new Map<string, Match[]>();
  for (const m of matches) {
    const path = JSON.stringify(m.path);
    groups.set(path, [...(groups.get(path) || []), m]);
  }
  for (const group of groups.values()) {
    let text = group[0].text;
    for (const m of [...group].reverse())
      text = text.slice(0, m.start) + replacement + text.slice(m.end);
    let owner: any = p;
    const path = group[0].path;
    for (const segment of path.slice(0, -1)) owner = owner[segment];
    owner[path.at(-1)!] = text;
  }
  return matches.length;
}
