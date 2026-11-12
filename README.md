# StoryTracks

An offline story outlining workspace built from [spec.md](spec.md), with a Rust/Tauri Windows application and a PHP edition sharing the React interface. Organize a book on a vertical canvas, keep writing guidance and historical context alongside it, and publish portable Markdown.

## Run the built application

- `dist/windows/StoryTracks-setup.msi`: WiX/MSI Windows installer, including the offline WebView2 runtime.
- `dist/windows/StoryTracks.exe`: application executable; requires an installed WebView2 runtime.
- `dist/StoryTracks-php.zip`: deployable PHP package. Extract it and follow its README; serve **only** its `public/` directory.

The obsolete EXE installer is retained under `dist/windows/previous/`; it does not contain the latest changes. Use the MSI above for installation.

Desktop projects live under `%LOCALAPPDATA%/com.storytracks.desktop/`, outside this checkout. The database and managed attachments are local; no external service or login is needed. The browser development preview uses its own IndexedDB storage, separate from desktop and PHP. To transfer a project, export a `.storytracks` backup and import it in the other edition.

The first launch opens a sample story and a skippable tutorial covering navigation, panel controls, writing guidance, nodes, notes, and publishing. Reopen it from **Settings → First-time tutorial → Open tutorial**. Use **My projects → New project** for your own work. Click a node title to edit it, use the eye icon to bring it into view, and open its settings for weights, transitions, lock/suspend controls, and keyboard-accessible move actions. Double-click story text to edit at that position: the card keeps its reading dimensions and canvas position, and the clicked text block receives the caret at the corresponding Markdown source offset. Writing fields grow as you type; **Done** returns to the reading view. **Publish** exports a readable snapshot; **Backup** preserves the editable project, templates, suspended content, trash, and attachments.

The canvas has three areas: **Sub-context** on the left, the main story in the center, and **Highlight** on the right. Select a node to see its connected notes: Sub-context holds the author's thoughts and feelings; Highlight holds commentary and comments. Both areas identify their connected node, allow reassignment, and respect node locks. Notes travel with backups and can be individually included in publication; suspended or trashed nodes' notes follow the same inclusion rules as their node. Earlier project-wide cards remain under **Unlinked notes** until you choose a node for them.

New projects can start from **Hero’s journey, Science fiction, Mystery, Self-help, Fantasy, or Memoir** templates. Each creates chapter headings and a guided workbook of questions to answer. Use the left panel's **Project guide** tab to answer prompts, add other guides without replacing existing work, and send an answer to an outline chapter.

The left panel also includes **World building** (places, cultures, history, institutions, technology/magic, daily life, and beliefs) and **Questions**. The latter is the **What was the question?** system: enter a statement or quote with attribution, generate editable question starters, select or write the underlying question, explore insights and alternative answers, identify readers who share the question, and draft a marketing hook. Suggestions use local language patterns; they are hypotheses for you to refine, not AI analysis or claims about the source author's intentions. All planning content autosaves, supports undo, travels in backups, and has explicit publication inclusion controls.

## Find and organize

Choose **Settings → Theme** for **Neon, Sunburst, Coffee, Glass, Frost, Morning, Night, or Evening**. Each palette uses readable text throughout the workspace, dialogs, dashboard, and PHP sign-in. Neon uses blue, green, and pink glows on dark ink surfaces; Sunburst uses bright gold and orange around pale writing cards; Glass has clear panel and node centers, glossy header/footer bands, reflective bevels, and a visible backdrop through the panes. Coffee is the initial theme. Changes apply immediately and the last choice returns when the app reopens on that device/browser. Theme preferences are independent of projects, backups, and published content.

The top-bar **Settings** cog opens **Theme** and **Fonts** in every edition (and on the PHP sign-in screen). **Verdana** is the initial font throughout the app. Choose an **App font**, use **Load system fonts**, or enter an installed font name. Windows lists installed families directly; supported browsers request local-font permission, with common choices and manual entry available otherwise. The five most recently selected fonts are saved as quick choices. **Make default** saves your preferred font, **Use default font** returns to it, and **Restore Verdana default** restores the original font. Preferences stay on the current device, including after restarting the app.

Use a slider or enter a pixel size for **Titles** (24–48), **Subtitles** (16–32), **Main text** (12–24), or **System text** (12–20). Changes apply immediately and sizes can be reset independently of the font family. Font preferences affect the interface rather than publication or project content. Panels, toolbars, and the three canvas areas reflow with the available space and font size; on narrow screens, open the outline or inspector individually.

Select text to show the floating formatting toolbar: **bold, italic, underline, strikethrough, highlight, inline code, headings, bulleted/numbered lists, and quotes**. It works directly on rendered story text and in writing fields, notes, planning answers, resources, and template text. Ctrl/Cmd+B, I, and U apply bold, italic, and underline to the selection. Formatting is stored as Markdown, with attribute-free `<u>` and `<mark>` tags for underline and highlighting; story reading and formatted publication previews display these styles. Locked nodes and linked template placements remain protected. Edit linked content through its template editor.

Hold **Space and drag**, or drag with the middle mouse button, to move the canvas freely left, right, up, or down at any zoom. **Reset canvas position** returns to the origin; **Fit selected node** brings the chosen node back into view. Space continues to insert spaces in writing fields.

Use **Find** in the outline or **Ctrl+F** to search; enable the **Replace** toggle or use **Ctrl+H** for replacement controls in the same dialog. The outline and dialog share the query and both offer an × clear button. Clicking a part name focuses all of its chapters; the adjacent arrow expands/collapses it. Find starts in the focused chapter, part, or whole book, and its **Search in** picker changes that scope. Optional case and whole-word matching, highlighted match navigation, node reveal, and single/bulk replacement are available. Search story titles and node text, or expand to notes, resources, and the workbook. Suspended material is included; trash is excluded. Locked material and linked template placements are read-only here; edit reusable template content through its template editor.

Use **Organize** in the left panel to select nodes, chapters, or parts with checkboxes. For nodes, hold **Shift** and click another checkbox to add the visible sequence from the most recently selected node, upward or downward; each range click becomes the next anchor. The organizer lives entirely in that panel. Move or copy nodes to a chapter, or choose a part to create a new unnamed chapter containing them. Move or copy chapters to a part, copy complete parts, and reorder selected items with Move up/down. Selection order follows the story, regardless of the order items were checked. Copies include active descendants, media references, and connected notes with independent IDs; copied items start unlocked. Moves preserve existing locks and reject blocked groups without partially applying the selection. Each action autosaves and is one undo step.

## Drawing and canvas space

Use **Hand annotation** above the work area to draw over the current chapter, part, or whole-book view. Choose ink color and width, erase whole strokes, undo/redo, or clear the layer. Drag the toolbar by its heading or use the arrow keys on the handle to move it within the visible work area. **Done annotating** restores normal interaction; the eye button hides or shows the marks. Marks follow canvas pan and zoom, stay in the project and its editable backup, and never appear in published Markdown. They attach to canvas positions, so changing the layout can move story content beneath them.

Create a node normally, then choose **Hand written** in the inspector’s **Node type** selector. On desktop the writing page opens at half the window width and full window height, with the title at the top left. The arrow swaps sides. The full-screen button centers the writable page at **90% of the window width** at the same height. Phones open directly in that centered view. Strokes autosave, remain editable after reopening, and publish as a PNG image reference with the image included in the export. **Done** waits for the project save before closing.

When the drawing extends beyond the visible area, select the **Pan** hand tool and drag, or use the arrows and position slider below the page. On a touch screen, drag with two fingers to pan while keeping the pen selected. On desktop, scroll over the page, drag with the middle button, or focus the page and hold **Space** while dragging.

**Sub-context** and **Highlight** start open. Their upper-corner arrows collapse each area independently, giving the main story more room. Click the remaining labeled rail to reopen it. This view preference is remembered per project on the current device; collapsing does not remove notes.

All eight themes use a subtle background on every even-numbered right-panel section and an even lighter tint on odd-numbered chapter groups in the outline.

## Publication preview and text resources

Open **Publish → Preview the storytrack** and switch between **Formatted** and **Plain text** to inspect the same Markdown snapshot. The view switch does not alter publication output. Formatted preview shows packaged images and keeps links inert.

Published Markdown is arranged for developing the book: each node is immediately followed by its included **Author’s thoughts** and **Commentary**, displayed as labeled blockquotes. Project, section, and chapter notes appear with their respective scope, including notes on empty sections. Writing guidance and node settings use readable lists, with effective chapter guidance above its nodes. General resources remain under **Reference material**; historical transcripts retain their companion document. Notes still follow their owner’s suspension/trash rules and individual publication choices.

In **Resources → File**, TXT and Markdown attachments load their content into the resource editor even when Windows supplies a missing or generic MIME type. UTF-8, BOM-marked UTF-16, and legacy Windows-1252 text are supported. The original bytes are kept separately; **Download attachment** returns that original file, including after the editable resource text changes. Downloads decode the stored bytes directly and verify their hash, without making a data-URL network request.

For AI-assisted reconstruction of DOCX, DOC, PDF, or other source documents, use [StoryTracks-AI-Document-Conversion.md](StoryTracks-AI-Document-Conversion.md). It contains extraction and coverage guidance, source-grounded analysis, metadata and node annotation rules, the current project structure, a validated example, and instructions for packaging an importable `.storytracks` archive.

## Develop and build

Frontend prerequisites: Node.js 22+ and npm. Windows desktop builds also require Rust stable, the MSVC C++ build tools/Windows SDK, and WebView2 for development. The desktop script uses a workspace-local Rust toolchain under `.local/toolchain/` when present, otherwise the toolchain on PATH. Dependencies must be downloaded before offline builds.

```powershell
npm ci
npm run dev             # browser development preview, 127.0.0.1:5173
npm run desktop:dev     # native development application
npm run build           # production UI, dist/php, and dist/StoryTracks-php.zip
npm run desktop:build   # production UI, Windows executable and WiX/MSI installer
```

Close a running `target/release/StoryTracks.exe` before rebuilding: Windows locks executable files in use. The Windows installer contains an offline WebView2 installer, so its size is substantially larger than the application executable. These development artifacts are unsigned.

```powershell
npm test                         # TypeScript domain/archive/publication tests
npm run schema                   # regenerate the versioned JSON schema
cargo test -p storytracks-core    # Rust validation/publication/persistence tests
php tests/php-fixtures.php        # PHP shared conformance and SQLite checks
php tests/php-handwriting.php     # drawing storage, publication, privacy, and locks
npm run build
npx playwright test              # production UI acceptance tests, installed Edge
node tests/php-http.mjs           # packaged PHP authentication/save/publish checks
```

The PHP HTTP test accepts `PHP_BINARY` and `PHP_EXTENSION_DIR` environment variables if PHP is not on PATH or its default INI is unsuitable. Browser tests use a separate headless Edge profile and a temporary server on port 5188; PHP HTTP tests use port 8317 and isolated temporary storage.

## Source map

| Directory | Responsibility |
| --- | --- |
| `apps/web/src` | Canvas, outline, inspector, autosave, transport adapters, archive exchange |
| `crates/storytracks-core` | Rust validation, lock rules, SQLite persistence, Markdown publication |
| `apps/desktop` | Native commands, selected-folder exports, Tauri/WiX MSI configuration |
| `apps/php` | Authenticated API, PHP validation/persistence/publication, deployment instructions |
| `contracts` | Versioned JSON schema and shared publication/import fixtures |
| `tests` | Domain, browser, and PHP acceptance checks |

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for verified behavior and remaining release acceptance work. The product specification is preserved in [spec.md](spec.md).
