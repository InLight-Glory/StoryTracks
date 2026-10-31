# Implementation and acceptance record

This is the first runnable implementation of `spec.md`. The specification remains the intended release behavior; this file records what has been implemented and what still needs release acceptance.

## Implemented

- Windows Tauri application with local SQLite and content-addressed attachments; NSIS packaging configured with the WebView2 offline installer.
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

## Verification

Validated on Windows 11 (10.0.26200), AMD Ryzen 9 5900HX, approximately 63 GiB reported RAM, Node 22.17, Rust 1.99.1, and PHP 8.2.12.

- TypeScript: 33 domain/archive/publication tests, including project templates, workbook round trips, question suggestions, node-associated annotations, locks, and legacy-note reassignment.
- Rust: 6 passing tests covering shared fixtures, locks/template behavior, publication, durable reopen, and stale revisions.
- PHP: 19 passing fixture checks plus an HTTP scenario covering authentication, CSRF, durable saves/reopen, empty metadata serialization, stale writes, and snapshot publication.
- Edge browser scenarios cover guided project creation, world building, question studies and hooks, create/import/edit/reload, duplicate archive identity handling, node-specific annotations, and a 2,000-node/100-chapter whole-book scenario. Timing is a local browser measurement, not a guarantee across hardware or editions.
- Native executable startup visually inspected; production TypeScript/Vite build and Rust compilation passed.
- Dependency audit after updating Zod: zero reported npm vulnerabilities.

## Remaining release acceptance and limits

- Run the installer in a clean Windows VM with networking disabled and no preinstalled WebView2, then complete media edit/reopen/publication. Bundling the runtime does not itself establish this acceptance result.
- Complete keyboard/screen-reader and high-DPI/responsive audits. Repeat the large-project and 100 ms edit-feedback measurements in native and PHP editions; the recorded browser run meets both targets.
- Exercise disk-full, process interruption during media writes, and migration failures. Version 1 initializes a new schema and refuses newer databases; there are no older production migrations to exercise yet.
- Archives are parsed and assembled in shared TypeScript before independent backend validation. Rust owns desktop persistence and Markdown publication, but does not yet provide a native ZIP archive parser.
- Media payloads are transferred as base64 with project snapshots. Off-screen media elements are unmounted and audio uses `preload="none"`, but large projects still keep their attachment data in memory. Streaming transport is future work.
- Media files are retained conservatively on disk; automatic orphan-file collection is not implemented. Trash retains original array positions and parent references; restore currently requires restoring a trashed ancestor first rather than selecting an alternate parent in the restore dialog.
- Text undo currently records input changes, rather than grouping a continuous typing session into a single action. History is limited to 100 in-session snapshots.
- External Markdown links are rendered as inert text. Historical resources preserve source, text, and import time; separate recording-date/speaker fields are not yet exposed.

No cloud sync, AI service, automatic audio transcription, or arbitrary graph branching is part of this build.
