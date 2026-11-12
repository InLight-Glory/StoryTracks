# Implementation and acceptance record

This is the first runnable implementation of `spec.md`. The specification remains the intended release behavior; this file records what has been implemented and what still needs release acceptance.

## Implemented

- Hand annotation overlays persist per chapter/part/whole-book canvas, follow pan/zoom, support ink colors/width, stroke erasing, undo/redo, clear, and hide/show. They remain in editable archives and are omitted from publication. Marks use canvas coordinates, not node-relative anchors.
- Hand written nodes retain editable vector strokes and immutable PNG assets. Their editor starts at 50vw × 100dvh, swaps sides, and centers the actual writing surface at 90vw at the same height. Drawing nodes are created through the regular node-type selector; the dedicated toolbar creation button has been removed. Title editing, local undo/redo, autosave, save-error recovery, and PNG Markdown publication are shared across editions. Extra horizontal content remains available when expanding again. Copying a drawing never overwrites the original node's image.
- Sub-context and Highlight independently collapse into labeled rails. Both default open; choices persist per project/device and notes are preserved.

- Settings → Theme offers Neon, Sunburst, Coffee, Glass, Frost, Morning, Night, and Evening across the shared Windows/browser/PHP interface, including PHP sign-in. Semantic colors cover workspace, planning, dialogs, editing, publication preview, and dashboard. Coffee is the initial palette; the last selection is applied before React renders and saved per device/browser, independently of project data.
- Windows Tauri application with local SQLite and content-addressed attachments; WiX/MSI packaging configured with the WebView2 offline installer.
- Deployable PHP application with the shared UI, SQLite persistence, password sessions, CSRF checks, remote HTTPS enforcement, and independent server validation.
- Dashboard, project creation/duplication/rename/deletion, search/sort, recent-entry hiding, and restoration of editor state.
- Resizable outline/canvas/inspector, chapter and whole-book views, virtualized node content, selection/eye navigation, pointer-centered zoom, pan, compact view, and keyboard move controls.
- Peach palette and dedicated Sub-context / Main story / Highlight canvas areas. Sub-context thoughts/feelings and Highlight commentary connect to individual nodes, follow selection and node locks, survive archive exchange, and follow their node's publication inclusion. Legacy unlinked notes can be assigned without data loss.
- Six guided project templates, a left-panel World Building workspace, and a What was the question? workspace for quotes/statements, local question suggestions, insights, alternative answers, audiences, and marketing hooks. Workbooks are optional version-1 fields so older projects continue to open; they are independently validated by both backends and included in publication only by explicit choice.
- Ordered text/image/audio blocks, captions/alternative text, optional audio transcript text, managed media, clipboard images, and playback/decode error placeholders.
- Weights and transitions, inherited chapter metadata with explicit blank overrides, scoped notes, reference documents and historical transcripts.
- Reusable linked templates with editable blocks/defaults, affected-chapter preview, independent placement weights, detachment, and lock enforcement.
- Lock/suspend/trash/restore, session undo/redo, debounced content saves, immediate queued structural saves, optimistic revisions, visible save failures, and recovery export for intact unsaved projects.
- Literal paragraph import, UTF-8 validation, versioned backup archives with identity-conflict choice, media hashes, expansion limits, and traversal protection.
- Matching TypeScript/Rust/PHP Markdown/history fixtures. Native publication uses a durable Rust snapshot and an atomically renamed output directory; PHP publication checks its durable revision. Existing native export directories are preserved by using a numeric suffix.

- Find/Replace dialog with literal case/whole-word search, highlighted occurrence navigation, node reveal, and single/bulk replacement respecting locks and linked templates.
- Left-panel-only organizer with node/chapter/part multiselection, stable bulk moves/reordering, deep copies including connected notes, and node-to-part transfers through a new unnamed chapter. Bulk actions are atomic and undoable.

## Verification

Drawing layout and theme refinement (November 11, 2026): expanded handwriting is centered at 90vw with unchanged height; returning to half width restores the chosen side. The toolbar creation button is removed, and the normal node/type-selector flow was verified through drawing, reload, and PNG publication. Fifteen targeted Edge scenarios passed, covering drawing, collapse, all eight themes, and responsive/font layouts. Every even inspector section has a palette-specific subtle tint; odd chapter groups have half-strength tints. Evening, Glass, and the centered expanded writing page were visually reviewed.

The refinement build completed successfully, including the normal copy to `dist/windows/StoryTracks.exe` and `dist/windows/StoryTracks-setup.msi`. Those files and `dist/StoryTracks-php.zip` contain the latest refinement; the earlier `StoryTracks-updated.exe` fallback is superseded.

Drawing and collapsible-area update (November 11, 2026): 55 TypeScript tests, 7 Rust tests, 19 PHP fixture checks plus the handwriting storage/publication/lock scenario, and 35 Edge scenarios passed. Packaged PHP authentication, save/reopen, stale-write protection, and publication checks also passed. Browser checks cover half/full editor dimensions, writing in the expanded area, side swapping, undo/redo, saved drawings after reload, PNG preview/export, private overlay persistence and zoom, and independent panel collapse/reopen without note loss. Half-width, 85%-width, and collapsed-area screenshots were visually reviewed. The existing 2,000-node timing benchmark was excluded from this regression run; no new performance claim is made.

Theme distinction refinement: Neon now uses neutral ink surfaces with blue, green, and pink edge glows; Sunburst uses saturated gold/orange surroundings and pale writing cards; Glass uses transparent panel/node centers, glossy header/footer bands, beveled reflective edges, and a visible backdrop with selective blur. Picker swatches preview these effects. Theme persistence and all four theme browser scenarios passed, including Glass story editing and connected notes on desktop and phone; palette and decorative-background contrast checks passed. Workspace screenshots of all three revised themes were visually reviewed. Windows EXE/MSI, browser assets, and PHP ZIP were rebuilt with the refinement.

Theme update (November 10, 2026): all eight palettes pass normal-text AA contrast checks for primary, secondary, accent, status, and button-label colors against their supported surfaces. All 51 TypeScript tests and 31 functional Edge scenarios passed across the test runs, including all theme choices, reload/reopen persistence, keyboard selection, narrow-screen layout, PHP sign-in, preference-write failure, font settings, and editing/publication workflows. Light/dark workspace and settings screenshots were visually reviewed. Windows EXE/MSI, browser assets, and PHP ZIP were rebuilt. The separate 2,000-node typing-feedback timing check exceeded its 100 ms target (107.8 ms, then 126.1 ms on a focused rerun); this remains a performance acceptance issue.

Font and editing update (November 6, 2026): Verdana is the shared default; Settings → Fonts supports native Windows font enumeration, browser local-font access with manual fallback, five recent choices, and a preferred default. Selection-only formatting works on rendered story text and writing fields, with safe underline/highlight markup and GFM strikethrough. Space/middle-drag moves the canvas in both axes, with reset-position and fit-selected controls.

Validation for this update: 49 TypeScript tests and all 29 Edge scenarios passed, including font persistence/history/defaults, permission-denied fallback, formatting save/reload/publication, phone toolbar layout, two-axis panning at normal/reduced zoom, and existing editing/organization/resource workflows. A native Windows test enumerated installed font families including Verdana; packaged PHP authentication/save/reopen/publication checks passed. Desktop and phone formatting screenshots were visually reviewed. The 2,000-node browser edit-feedback check measured 98.6 ms in this run.

Publication preview offers formatted and plain modes. Local text resources support missing/generic MIME types and UTF-8, BOM-marked UTF-16, and Windows-1252 text. Editable text is separate from the original attachment; downloads verify the saved bytes and build a Blob directly. The AI document-conversion guide includes a validated, archive-tested example project.

Validated on Windows 11 (10.0.26200), AMD Ryzen 9 5900HX, approximately 63 GiB reported RAM, Node 22.17, Rust 1.99.1, and PHP 8.2.12.

- TypeScript: 44 domain/archive/publication tests, including project templates, workbook round trips, question suggestions, node-associated annotations, locks, legacy-note reassignment, bulk organizing, Shift range selection, chapter/part search scopes, Find/Replace, local text decoding/download integrity, and conversion-guide validation.
- Rust: 6 passing tests covering shared fixtures, locks/template behavior, publication, durable reopen, and stale revisions.
- PHP: 19 passing fixture checks plus an HTTP scenario covering authentication, CSRF, durable saves/reopen, empty metadata serialization, stale writes, and snapshot publication.
- Seven Edge browser scenarios cover guided project creation, world building, question studies and hooks, create/import/edit/reload, duplicate archive identity handling, node-specific annotations, bulk organizing and Find/Replace with undo/reload at 1280×720, Shift ranges/clear search/part focus/Replace toggle, and a 2,000-node/100-chapter whole-book scenario. Timing is a local browser measurement, not a guarantee across hardware or editions; the latest successful large-project edit-feedback measurement was 88.4 ms, with an earlier run at 103.2 ms.
- Native executable startup visually inspected; production TypeScript/Vite build and Rust compilation passed.
- Two additional Edge scenarios verify formatted/plain preview and text resource import/open/reload/exact-byte download under a CSP that blocks data-URL requests. The latter reproduces the desktop download restriction in the browser; the native save-file dialog itself was not exercised in this check.
- Dependency audit after updating Zod: zero reported npm vulnerabilities.

## Remaining release acceptance and limits

- November 11 drawing build: UI/PHP ZIP, native executable, and MSI generation succeeded. The final copy over `dist/windows/StoryTracks.exe` was blocked by a Windows file lock; the new executable is `dist/windows/StoryTracks-updated.exe`. The current MSI was copied to `dist/windows/StoryTracks-setup.msi` and verified against the generated installer by SHA-256. Close the old executable before replacing it.

- Windows packaging uses WiX/MSI. The latest NSIS/EXE rebuild failed twice with `Can't open output file`, including after moving its previous build aside. The old distribution EXE installer is archived under `dist/windows/previous/` and is not current. The desktop build requires an MSI output and copies it to `dist/windows/StoryTracks-setup.msi`; no antivirus settings were changed.
- Run the installer in a clean Windows VM with networking disabled and no preinstalled WebView2, then complete media edit/reopen/publication. Bundling the runtime does not itself establish this acceptance result.
- Complete keyboard/screen-reader and high-DPI/responsive audits. Repeat the large-project and 100 ms edit-feedback measurements in native and PHP editions; the recorded browser run meets both targets.
- Exercise disk-full, process interruption during media writes, and migration failures. Version 1 initializes a new schema and refuses newer databases; there are no older production migrations to exercise yet.
- Archives are parsed and assembled in shared TypeScript before independent backend validation. Rust owns desktop persistence and Markdown publication, but does not yet provide a native ZIP archive parser.
- Media payloads are transferred as base64 with project snapshots. Off-screen media elements are unmounted and audio uses `preload="none"`, but large projects still keep their attachment data in memory. Streaming transport is future work.
- Media files are retained conservatively on disk; automatic orphan-file collection is not implemented. Trash retains original array positions and parent references; restore currently requires restoring a trashed ancestor first rather than selecting an alternate parent in the restore dialog.
- Text undo currently records input changes, rather than grouping a continuous typing session into a single action. History is limited to 100 in-session snapshots.
- External Markdown links are rendered as inert text. Historical resources preserve source, text, and import time; separate recording-date/speaker fields are not yet exposed.

No cloud sync, AI service, automatic audio transcription, or arbitrary graph branching is part of this build.
