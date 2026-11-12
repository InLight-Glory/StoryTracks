import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  formatSelection,
  inlineFormatting,
  textFormats,
} from "../apps/web/src/textFormatting";
import { chooseFont, normalizeFonts, fontStack } from "../apps/web/src/fonts";

test("font preferences retain five unique recent choices and an independent default", () => {
  let fonts = normalizeFonts(null);
  assert.equal(fonts.default, "Verdana");
  for (const name of [
    "Arial",
    "Georgia",
    "Tahoma",
    "Consolas",
    "Cambria",
    "Calibri",
    "Arial",
  ])
    fonts = chooseFont(fonts, name);
  assert.deepEqual(fonts.recent, [
    "Arial",
    "Calibri",
    "Cambria",
    "Consolas",
    "Tahoma",
  ]);
  assert.equal(fonts.default, "Verdana");
  assert.equal(
    normalizeFonts({
      current: {},
      default: "Georgia",
      recent: [null, "Arial", "arial"],
    }).current,
    "Georgia",
  );
  assert.deepEqual(
    normalizeFonts({ recent: [null, "Arial", "arial"] }).recent,
    ["Arial"],
  );
  assert.equal(
    fontStack('A "quoted" font'),
    '"A \\"quoted\\" font", Verdana, Arial, sans-serif'.replaceAll(
      "\\\\",
      "\\",
    ),
  );
});

test("inline formatting preserves the selection and toggles without disturbing surrounding text", () => {
  for (const format of textFormats.filter((format) => "before" in format)) {
    const formatted = formatSelection("A quiet station.", 2, 7, format);
    assert.equal(formatted.text.slice(formatted.start, formatted.end), "quiet");
    const restored = formatSelection(
      formatted.text,
      formatted.start,
      formatted.end,
      format,
    );
    assert.equal(restored.text, "A quiet station.");
    assert.deepEqual([restored.start, restored.end], [2, 7]);
  }
});

test("block formatting applies to complete selected lines and toggles back", () => {
  const format = textFormats.find((format) => format.name === "Bulleted list")!;
  const next = formatSelection("one\ntwo\nthree", 1, 6, format);
  assert.equal(next.text, "- one\n- two\nthree");
  assert.equal(
    formatSelection(next.text, next.start, next.end, format).text,
    "one\ntwo\nthree",
  );
});

test("bold and italic can be combined and toggled independently", () => {
  const italic = textFormats.find((format) => format.name === "Italic")!;
  const bold = textFormats.find((format) => format.name === "Bold")!;
  const both = formatSelection("**quiet**", 2, 7, italic);
  assert.equal(both.text, "***quiet***");
  assert.equal(
    formatSelection(both.text, both.start, both.end, italic).text,
    "**quiet**",
  );
  assert.equal(
    formatSelection(both.text, both.start, both.end, bold).text,
    "*quiet*",
  );
});

test("formatted preview renders emphasis, underline, deletion, and highlights without enabling arbitrary HTML", () => {
  const render = (text: string) =>
    renderToStaticMarkup(
      createElement(ReactMarkdown, {
        skipHtml: true,
        remarkPlugins: [remarkGfm, inlineFormatting],
        children: text,
      }),
    );
  const html = render(
    "**bold** *italic* <u>under **both**</u> ~~gone~~ <mark>light</mark>\n\n- first\n- second",
  );
  for (const expected of [
    "<strong>bold</strong>",
    "<em>italic</em>",
    "<u>under <strong>both</strong></u>",
    "<del>gone</del>",
    "<mark>light</mark>",
    "<ul>",
  ])
    assert.ok(html.includes(expected), html);
  const unsafe = render(
    '<u onclick="alert(1)">no</u> <script>alert(1)</script> <img src=x onerror=alert(1)>',
  );
  assert.ok(!/<script|<img|onclick|onerror/.test(unsafe));
  assert.ok(render("`<u>literal</u>`").includes("&lt;u&gt;literal&lt;/u&gt;"));
});
