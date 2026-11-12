import type { Root, RootContent, PhrasingContent } from "mdast";

export const textFormats = [
  { name: "Bold", before: "**", after: "**", key: "b" },
  { name: "Italic", before: "*", after: "*", key: "i" },
  { name: "Underline", before: "<u>", after: "</u>", key: "u" },
  { name: "Strikethrough", before: "~~", after: "~~" },
  { name: "Highlight", before: "<mark>", after: "</mark>" },
  { name: "Code", before: "`", after: "`" },
  { name: "Heading", prefix: "## " },
  { name: "Bulleted list", prefix: "- " },
  { name: "Numbered list", prefix: "1. " },
  { name: "Quote", prefix: "> " },
] as const;
export type TextFormat = (typeof textFormats)[number];
export function formatSelection(
  text: string,
  start: number,
  end: number,
  format: TextFormat,
) {
  if ("prefix" in format) {
    const from = text.lastIndexOf("\n", start - 1) + 1;
    const last = text.indexOf(
      "\n",
      end > start && text[end - 1] === "\n" ? end - 1 : end,
    );
    const to = last < 0 ? text.length : last;
    const lines = text.slice(from, to).split("\n");
    const remove = lines.every((line) => line.startsWith(format.prefix));
    const value = lines
      .map((line) =>
        remove ? line.slice(format.prefix.length) : format.prefix + line,
      )
      .join("\n");
    return {
      text: text.slice(0, from) + value + text.slice(to),
      start: from,
      end: from + value.length,
    };
  }
  const { before, after } = format;
  const selected = text.slice(start, end);
  const starsBefore = text.slice(0, start).match(/\*+$/)?.[0].length || 0;
  const starsAfter = text.slice(end).match(/^\*+/)?.[0].length || 0;
  const canUnwrap =
    before !== "*" || (starsBefore % 2 === 1 && starsAfter % 2 === 1);
  if (
    canUnwrap &&
    start >= before.length &&
    text.slice(start - before.length, start) === before &&
    text.slice(end, end + after.length) === after
  ) {
    return {
      text:
        text.slice(0, start - before.length) +
        selected +
        text.slice(end + after.length),
      start: start - before.length,
      end: end - before.length,
    };
  }
  if (
    selected.startsWith(before) &&
    selected.endsWith(after) &&
    selected.length >= before.length + after.length &&
    (before !== "*" ||
      ((selected.match(/^\*+/)?.[0].length || 0) % 2 === 1 &&
        (selected.match(/\*+$/)?.[0].length || 0) % 2 === 1))
  ) {
    const value = selected.slice(before.length, -after.length);
    return {
      text: text.slice(0, start) + value + text.slice(end),
      start,
      end: start + value.length,
    };
  }
  return {
    text: text.slice(0, start) + before + selected + after + text.slice(end),
    start: start + before.length,
    end: end + before.length,
  };
}

// Permit only these exact, attribute-free inline tags. All other raw HTML
// continues to be skipped by ReactMarkdown; arbitrary HTML is never executed.
export function inlineFormatting() {
  return (tree: Root) => {
    function visit(parent: { children: RootContent[] }) {
      for (const child of parent.children)
        if ("children" in child) visit(child);
      const result: RootContent[] = [];
      const stack: {
        tag: string;
        children: RootContent[];
        opening: RootContent;
      }[] = [];
      const append = (child: RootContent) =>
        (stack.at(-1)?.children || result).push(child);
      for (const child of parent.children) {
        const tag =
          child.type === "html"
            ? child.value.match(/^<(\/)?(u|mark|sub|sup)>$/i)
            : null;
        if (tag && !tag[1])
          stack.push({
            tag: tag[2].toLowerCase(),
            children: [],
            opening: child,
          });
        else if (tag && tag[1] && stack.at(-1)?.tag === tag[2].toLowerCase()) {
          const entry = stack.pop()!;
          append({
            type: "emphasis",
            data: { hName: entry.tag },
            children: entry.children as PhrasingContent[],
            position:
              entry.opening.position && child.position
                ? {
                    start: entry.opening.position.start,
                    end: child.position.end,
                  }
                : undefined,
          });
        } else append(child);
      }
      while (stack.length) {
        const entry = stack.pop()!;
        for (const child of [entry.opening, ...entry.children]) append(child);
      }
      parent.children = result;
    }
    visit(tree);
  };
}
