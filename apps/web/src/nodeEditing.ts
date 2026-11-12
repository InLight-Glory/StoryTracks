import type { Element, Root, Text } from "hast";

// Retain Markdown source positions on rendered text, including text inside
// emphasis and links. These offsets use UTF-16, just like textarea selections.
export function sourcePositions() {
  return (tree: Root) => {
    function visit(parent: Root | Element) {
      parent.children = parent.children.map((child) => {
        if (child.type === "element") visit(child);
        if (child.type !== "text" || !child.value.trim()) return child;
        const position = child.position || parent.position;
        if (
          position?.start.offset === undefined ||
          position.end.offset === undefined
        )
          return child;
        return {
          type: "element",
          tagName: "span",
          properties: {
            "data-source-start": position.start.offset,
            "data-source-end": position.end.offset,
          },
          children: [child as Text],
        } satisfies Element;
      });
    }
    visit(tree);
  };
}

function sourceOffset(
  source: string,
  rendered: string,
  offset: number,
  start: number,
  end: number,
) {
  const raw = source.slice(start, end);
  const literal = raw.indexOf(rendered);
  if (literal >= 0) return start + literal + offset;
  const starts: number[] = [];
  let decoded = "";
  for (let index = 0; index < raw.length;) {
    const tokenStart = index;
    let value = raw[index++];
    if (
      value === "\\" &&
      /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/.test(raw[index] || "")
    )
      value = raw[index++];
    else if (value === "&") {
      const entity = raw
        .slice(tokenStart)
        .match(/^&(?:#[xX][\da-fA-F]+|#\d+|[a-zA-Z][\da-zA-Z]*);/);
      if (entity) {
        const decoder = document.createElement("textarea");
        decoder.innerHTML = entity[0];
        value = decoder.value;
        index = tokenStart + entity[0].length;
      }
    }
    decoded += value;
    for (let unit = 0; unit < value.length; unit++)
      starts.push(start + tokenStart);
  }
  let cursor = 0;
  for (let index = 0; index < rendered.length; index++) {
    const next = decoded.indexOf(rendered[index], cursor);
    if (next < 0) return Math.min(end, start + offset);
    if (index === offset) return starts[next];
    cursor = next + 1;
  }
  return end;
}

export function selectedSourceRange(
  element: HTMLElement,
  source: string,
  range: Range,
) {
  if (
    !element.contains(range.startContainer) ||
    !element.contains(range.endContainer)
  )
    return null;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let start: number | undefined;
  let end: number | undefined;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!range.intersectsNode(node)) continue;
    const marker = node.parentElement?.closest<HTMLElement>(
      "[data-source-start]",
    );
    if (!marker) continue;
    const from = range.startContainer === node ? range.startOffset : 0;
    const to =
      range.endContainer === node ? range.endOffset : node.textContent!.length;
    if (from === to) continue;
    const prefix = document.createRange();
    prefix.selectNodeContents(marker);
    prefix.setEnd(node, 0);
    const offset = prefix.toString().length;
    const map = (index: number) =>
      sourceOffset(
        source,
        marker.textContent || "",
        offset + index,
        Number(marker.dataset.sourceStart),
        Number(marker.dataset.sourceEnd),
      );
    start ??= map(from);
    end = map(to);
  }
  return start !== undefined && end !== undefined && end > start
    ? { start, end }
    : null;
}

function caretAt(
  x: number,
  y: number,
): { node: Node; offset: number } | undefined {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const position = doc.caretPositionFromPoint?.(x, y);
  if (position) return { node: position.offsetNode, offset: position.offset };
  const range = doc.caretRangeFromPoint?.(x, y);
  if (range) return { node: range.startContainer, offset: range.startOffset };
}

export function clickedOffset(
  element: HTMLElement,
  source: string,
  x: number,
  y: number,
  markdown: boolean,
) {
  const caret = caretAt(x, y);
  if (!caret || !element.contains(caret.node)) return source.length;
  const textElement =
    caret.node.nodeType === Node.TEXT_NODE
      ? caret.node.parentElement
      : (caret.node as HTMLElement);
  const marker = markdown
    ? textElement?.closest<HTMLElement>("[data-source-start]")
    : element;
  if (!marker || !element.contains(marker)) return source.length;
  const range = document.createRange();
  range.selectNodeContents(marker);
  range.setEnd(caret.node, caret.offset);
  const offset = range.toString().length;
  return markdown
    ? sourceOffset(
        source,
        marker.textContent || "",
        offset,
        Number(marker.dataset.sourceStart),
        Number(marker.dataset.sourceEnd),
      )
    : Math.min(source.length, offset);
}

export type EditSnapshot = {
  id: string;
  titleHeight: number;
  footerHeight: number;
  blocks: Record<string, number>;
  target: string;
  offset: number;
  clickY: number;
  scrollTop: number;
  scrollLeft: number;
};

// Reveal the caret within the text box without moving the surrounding canvas.
export function focusAt(
  field: HTMLTextAreaElement,
  offset: number,
  clickY: number,
) {
  field.focus({ preventScroll: true });
  field.setSelectionRange(offset, offset);
  const style = getComputedStyle(field);
  const mirror = document.createElement("div");
  Object.assign(mirror.style, {
    position: "fixed",
    visibility: "hidden",
    top: "0",
    left: "0",
    width: `${field.clientWidth}px`,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    font: style.font,
    letterSpacing: style.letterSpacing,
    tabSize: style.tabSize,
  });
  mirror.textContent = field.value.slice(0, offset);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.append(marker);
  document.body.append(mirror);
  field.scrollTop = Math.max(0, marker.offsetTop - Math.max(0, clickY));
  mirror.remove();
}
