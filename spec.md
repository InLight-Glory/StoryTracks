# StoryTracks — Application Specification

Status: initial build specification. User-requested behavior is captured below; implementation choices and unspecified interaction details are proposed defaults.

## 1. Purpose

StoryTracks is an offline-capable book outlining application built around a vertical node canvas. Writers organize sections, chapters, story beats, recurring material, notes, and historical context, then publish their current outline as a portable Markdown storytrack.

The primary application uses Rust and runs locally. A second distribution lives in `dist/php` and provides the same core editing and publishing experience through a browser and PHP server.

StoryTracks organizes instructions and source material for a writer. The initial release does not require an AI service, generate prose, or automatically transcribe audio. Node weights and writing metadata are preserved as explicit guidance in exports for human writers or optional future integrations.

## 2. Distribution and architecture

### 2.1 Rust desktop edition

- Build the desktop application with a Rust domain layer and Tauri desktop shell. Use a shared TypeScript web interface for the canvas, panels, and dashboard. This is a Rust-backed desktop application, with its interface implemented using web technologies.
- Ship a Windows application executable, `StoryTracks.exe`, and an offline-capable `StoryTracks-setup.exe` installer. A single dependency-free portable executable is not a release requirement.
- Bundle all application scripts, styles, fonts, icons, and other required assets locally. Core functionality must never require a login, internet connection, CDN, remote API, or PHP server.
- Include the WebView2 offline installer in the Windows installer so installation can succeed without downloading dependencies. Tauri supports Windows executable installers and bundled offline runtime installation; see its [Windows distribution documentation](https://v2.tauri.app/distribute/windows-installer/).
- Use local SQLite persistence and project-managed media files. The Rust layer owns validation, transactions, filesystem access, import, export, and project operations.
- Target Windows first. Keep platform-specific filesystem and shell behavior isolated to support later macOS/Linux builds.

### 2.2 PHP edition

- Produce a deployable package in `dist/php`. It includes compiled interface assets, PHP application code, required production dependencies, database migrations, installation instructions, and a configuration example.
- The deployed package must run without Rust, Node.js, Composer, or frontend build tooling installed on the server. Build-time tooling may generate the package.
- Use a supported PHP 8.x runtime, PDO SQLite, and required upload/archive extensions. Pin and document the exact supported runtime and extension requirements during implementation. PHP provides SQLite access through [PDO_SQLITE](https://www.php.net/manual/en/ref.pdo-sqlite.php).
- Share the interface and versioned data contracts with desktop. Implement server-side validation and persistence in PHP; do not assume Rust source can be converted directly into PHP.
- Use Tauri commands for the desktop transport and same-origin HTTP endpoints for the PHP transport, behind one interface adapter.
- Start with one owner per PHP installation. Require password authentication and secure sessions when remotely hosted. Local deployments bind to loopback by default. Collaboration and multiple owner accounts are outside the initial scope.
- Store databases and uploaded files outside the public document root. Serve authorized files through the application.
- A local PHP installation can operate without internet. A remotely hosted PHP installation requires connectivity to its server; disconnected browser editing is not required for the first release.
- Maintain functional parity for projects, outline editing, weights, templates, metadata, imports, media, trash, and publishing. OS file dialogs and browser download/upload mechanisms may differ.

### 2.3 Suggested source layout

```text
crates/storytracks-core/       Rust domain, validation, persistence, import/export
apps/desktop/                 Tauri shell and desktop configuration
apps/web/                     Shared interface and transport adapters
apps/php/                     PHP application source and migrations
contracts/                    Versioned schemas and shared conformance fixtures
tests/fixtures/               Import, export, migration, and parity examples
dist/php/                     Generated deployable PHP package
dist/windows/                 Generated Windows release artifacts
```

Keep generated distribution artifacts out of source control unless a release workflow explicitly requires them. Version the schemas independently of application releases. Both backends must pass the same behavioral fixtures rather than relying on duplicated code staying equivalent by convention.

## 3. Main user journeys

1. Open the app, see recent projects, and continue a previous project or create a new one.
2. Create a project, set its metadata, and add sections, chapters, and nodes.
3. Paste or import existing notes; preview the resulting nodes and insert them into a chapter.
4. Arrange the book using the flow overview and vertical canvas, adjusting node weights and chapter guidance.
5. Save reusable node templates and insert independent placements throughout the book.
6. Attach reference documents and historical transcripts without adding them to the narrative sequence.
7. Publish a snapshot as `(project name)-st.md`, with supporting history and media files where needed.

## 4. Dashboard and project lifecycle

- Show project name, optional description, last edited time, and section/chapter/node counts. Desktop also shows its local location.
- Provide **New project**, **Continue**, **Open/import project**, search, and sort by recently edited or name.
- A new project asks for a name and optional description, then creates one section, one chapter, and an empty canvas ready for a first node.
- Restore the last selected chapter/node, panel sizes, expanded outline rows, and viewport when reopening.
- Allow rename, duplicate, portable backup, and remove from recent projects. Removing a recent entry must not delete its files.
- Project deletion is a separate action with a clear confirmation. Project duplication creates independent content and attachments.
- Display explicit saving, saved, and save-failed states. Never report an edit as saved before durable persistence succeeds.

## 5. Editor layout

Use three resizable regions below a toolbar: flow overview on the left, canvas in the center, and a tabbed inspector on the right. Panels can be collapsed to maximize canvas space. The toolbar exposes project navigation, undo/redo, import, publish, save state, and canvas controls.

### 5.1 Left panel: flow overview

Represent the book as `Project → Sections → Chapters → Node placements`.

- Show the current book order, names, chapter numbers, status indicators, and nested nodes.
- Allow adding, renaming, collapsing/expanding, and rearranging sections and chapters, and moving nodes within or between chapters.
- Support drag-and-drop plus keyboard-accessible move up/down and move-to actions.
- Each section can be locked, suspended, or moved to trash. Apply the same controls to chapters and nodes for consistent behavior.
- Each node row has an **eye** button. Clicking it selects the node and pans/zooms the canvas so its title/header is visible near the top of the usable canvas. Use a comfortable readable zoom, accounting for open panels and toolbar offsets.
- An untitled node still has a header anchor and an outline label derived from its first text line, falling back to “Untitled node.” The derived label does not become authored text.
- Collapsing a row changes only the overview presentation; it does not remove content from the canvas or export.

#### Chapter numbering

- Default to automatic, project-wide sequential chapter numbering in active book order.
- Allow a manual display number/label such as “Prologue,” “3A,” or “Epilogue,” and allow switching back to automatic numbering.
- Renumber automatically after reorder, suspension, restoration, or deletion of automatically numbered chapters. Suspended and trashed chapters do not consume automatic numbers.
- Chapter identity is a stable ID, independent of its number and name. Warn about duplicate manual labels without changing them silently.

#### Lock, suspend, and trash semantics

| State/action | Editing and ordering | Canvas and outline | Default publication |
| --- | --- | --- | --- |
| Collapse | No content restrictions | Children hidden in outline only | Included |
| Lock | Prevent content, metadata, weight, order, membership, suspension, and trash changes to the item/subtree | Visible with lock indicator | Included if active |
| Suspend | Preserve content and position; editing allowed when shown and unlocked | Hidden from normal canvas; recoverable using “Show suspended” in outline | Excluded |
| Move to trash | Preserve item, descendants, and restore location | Removed from normal canvas and outline; available in Trash | Excluded |

- Locks are inherited from ancestors. Unlock the originating ancestor before changing a descendant. Selection, navigation, copying, and export remain available.
- A structural action must not indirectly alter a locked subtree. Reject parent moves/deletions or drag operations that would cross a locked sibling's ordering boundary; explain which lock blocks the action. Inserting unlocked neighbors may change displayed chapter numbers without changing locked authored content.
- Suspending a section suspends its descendants effectively, without overwriting their individual states. Unsuspending the parent preserves any explicitly suspended child.
- The eye button for a suspended node opens a temporary preview without unsuspending it or changing publish inclusion.
- Trash supports restore, with its original position when possible, and a chosen unlocked fallback location otherwise. Permanent deletion requires confirmation.
- Undo a move to trash without losing descendants, template references, or attachments. Garbage-collect media only when no live item, template, history document, or restorable trash item references it.

### 5.2 Center: node canvas

- Display the narrative as one vertical stack: section heading, chapter heading, then ordered nodes from top to bottom.
- The outline and canvas use the same canonical order. Reordering in either updates both immediately; free positioning must not silently change story order.
- Render the whole active book with virtualization for large projects. Highlight the selected chapter and allow a chapter-only view.
- Add a node using an add button, an insertion point between nodes, or a context menu. Insert into the selected chapter at an explicit location.
- Each node contains an optional title, an ordered media/content box, a settings cog, and compact status indicators.
- The media box supports interleaved text, images, and audio blocks, line by line. Users can insert, reorder, edit, and remove blocks independently.
- Text preserves paragraph boundaries and line breaks. Support basic emphasis and lists; store structured blocks rather than unrestricted executable HTML.
- Images support imported files, clipboard images where supported, captions, and alternative text. Audio supports imported files, play/pause, seeking, and optional captions/transcript text.
- Copy imported media into managed project storage. Do not depend on an original file remaining at its source path. Show a recoverable placeholder if a managed attachment is missing or cannot be decoded.
- Drag a node using its header handle to reorder. Dragging inside text selects text and must not move a node or pan the canvas.
- Mouse wheel scrolls vertically; middle-button drag or Space+drag pans; Ctrl+wheel zooms around the pointer. Provide zoom buttons, reset to 100%, and fit-to-selection. Proposed zoom range: 25–200%.
- Canvas zoom must not resize unrelated panels. Respect reduced-motion preferences when navigating to a node.
- Selection is synchronized across the outline, canvas, and inspector.

### 5.3 Right panel: tabs

Required tabs:

1. **Project metadata** — project-wide writing guidance and descriptive fields.
2. **Chapter metadata** — guidance for the selected chapter, with inherited values visible.
3. **Side notes** — freeform notes attached to the project, chapter, or node, with a clearly displayed scope.
4. **Documents/resources** — reference files, historical transcripts, descriptions, and publication inclusion controls.
5. **Node templates** — searchable reusable templates with preview, creation, editing, duplication, and placement actions.

The node settings cog opens the node's weights and transition controls in a popover or inspector area without switching to a different node. Additional tabs can be added later without changing the core project format.

## 6. Writing metadata

### 6.1 Project metadata

Include project name, author, description/logline, genre, intended audience, language, overall writing style, tone, mood, point of view, tense, optional target length, and freeform writing instructions.

Style, tone, and mood accept editable suggestions and custom text. Do not restrict users to a fixed taxonomy.

### 6.2 Chapter metadata

Include chapter name/number, summary or purpose, pacing/speed, mood, tone, optional style override, point of view, tense, target length, and chapter-specific instructions.

- Pacing defaults to “Inherit” and supports very slow, slow, moderate, fast, very fast, or custom guidance. Add an optional project-level pacing default.
- Other writing fields also support inheritance where a project equivalent exists.
- A missing override means inherit; an explicit blank value can clear guidance. Store the distinction.
- Show both the effective value and whether it comes from the project or chapter.
- Preserve authored overrides and effective guidance in publication so downstream readers do not need to guess precedence.
- Metadata guides writing; changing it must not rewrite node content.

## 7. Node weights and transitions

Every placed node, including each template placement, has its own settings. These values are guidance, not probabilities or automatic inclusion rules.

| Setting | Range | Default | Meaning |
| --- | --- | --- | --- |
| Importance | 1.0–5.5 inclusive | 3.0 | How important this node is to the book; higher means greater emphasis and preservation priority. |
| Liberty | 1.0–5.5 inclusive | 1.0 | How much a writer may deviate from the node's content; higher means more freedom. |
| Beginning sharpness | 0–100 inclusive | 50, moderate | Transition into this node: 0 is very gradual; 100 is abrupt/sharp. |
| Ending sharpness | 0–100 inclusive | 50, moderate | Transition out of this node: 0 is very gradual; 100 is abrupt/sharp. |

- Importance and liberty use sliders plus numeric inputs with 0.5 steps, including the 5.5 endpoint. This increment is a proposed default.
- Sharpness uses two independent labeled sliders, “Beginning” and “Ending,” with numeric values and gradual/moderate/sharp descriptions. Suggested labels: 0–33 gradual, 34–66 moderate, 67–100 sharp.
- Store importance/liberty as integer half-step units, 2–11, and display/export them as decimal values to avoid floating-point inconsistencies between runtimes.
- Show concise explanations next to controls and offer reset to defaults.
- Reject out-of-range values in both the interface and backend. Do not silently clamp malformed imported data.
- Low importance does not hide a node. Low liberty does not lock editing. Only explicit user actions change those states.
- For adjacent active nodes A and B, preserve both A's ending and B's beginning sharpness. Do not average them or assume they must match. Previous/next refer to active publish order, including across chapter boundaries.
- For the first/last active node, the respective opening/closing setting describes entry to or exit from the story.
- Publish numeric values and their meaning so another writer or system can interpret them without this application.

## 8. Reusable node templates

- Templates are project-scoped reusable content definitions containing a name, optional node title, ordered content blocks, optional description/tags, and default weights/sharpness.
- A repeated saying is a typical template. Users insert it into multiple chapters without repeatedly authoring its text.
- Inserting a template creates a distinct node placement with its own ID, order, chapter, status, and weight settings. Template default weights are copied at insertion time; later default changes affect future placements only.
- Template content is linked by default. Editing template content updates linked placements, while their placement-specific weights remain unchanged.
- Before saving a template content change, show the number and locations of affected placements. If any linked placement is effectively locked, block the update until those placements are unlocked or explicitly detached while unlocked.
- Editing linked content from a placement offers **Edit template** or **Detach and edit this node**. Detaching copies the current content and preserves the placement ID, order, and settings.
- Allow resetting an individual placement's weights to the template's current defaults as an explicit undoable action.
- Deleting a referenced template requires choosing either to cancel or detach all its placements while preserving resolved content. Do not leave dangling references; locks may block detachment.
- Publication always expands each included placement to its resolved content and records its own weights. A published storytrack must be understandable without the template library.

## 9. Text import and historical context

### 9.1 Quick outline import

Support pasted text and UTF-8 `.txt`/`.md` files. Interpret the requested “double new lines” as one or more blank separator lines.

1. Normalize CRLF/CR to LF and handle an optional UTF-8 BOM.
2. Split on two or more newline characters, allowing spaces/tabs on otherwise blank separator lines.
3. Ignore empty fragments; preserve single line breaks and internal formatting within each fragment.
4. Create one ordinary node per nonempty fragment, in source order, using default node weights.
5. Leave titles unset by default. Offer optional first-line-as-title handling in the preview; do not invent titles or metadata.
6. Show the node count, node previews, and target chapter/insertion position before committing.
7. Commit as one undoable transaction. Cancel and invalid input must leave the project unchanged.

This mode is literal paragraph splitting, including blank lines within Markdown lists or code blocks. Explain that in the preview; syntax-aware document conversion can be added later. Warn about unsupported encoding and oversized files rather than corrupting text.

### 9.2 Historical transcripts

- Provide a separate **Import as historical transcript** action, accepting pasted text and UTF-8 `.txt`/`.md` files.
- Store transcripts as project resources of type `historical_transcript`, with title, source filename or description, import time, optional recording date/speakers, and text.
- Preserve timestamps, speaker labels, and original wording. Historical material is context, not a narrative node or an instruction that overrides writing metadata.
- Imported transcripts are included in publication by default, with a visible per-document inclusion toggle. Preview clearly identifies anything excluded.
- Publish included transcripts into a companion Markdown history document, `(project name)-history.md`, linked from the storytrack.
- Reference documents and ordinary side notes are excluded from publication by default, with explicit opt-in inclusion controls. Their setting is independent of transcript defaults.
- Importing audio as a node or resource does not automatically produce a transcript. Optional speech-to-text is a future feature.

## 10. Publishing and portability

### 10.1 Publish behavior

“Publish” means export a local/downloadable snapshot; it does not upload or publicly host the project.

- The primary output is `(project name)-st.md`, where `st` means **storytrack**.
- Sanitize filesystem-reserved characters in the filename while preserving the authored project name inside the document. Preview the exact output filename and ask before overwriting an existing export.
- Export the durable project revision captured at the start of publication. Later edits must not cause mixed-revision output. If unsaved edits cannot be persisted, report the failure and do not silently export an older revision.
- Include active sections, chapters, and nodes in canonical sequence. Exclude trash always. Exclude suspended content by default; an explicit “Include suspended material” option includes it in its original position with clear status labels.
- Include project metadata, chapter metadata and effective writing guidance, resolved node content, node weights, and transition settings.
- Include selected side notes/resources in clearly marked context sections, separate from the narrative outline.
- With included transcripts, also generate `(project name)-history.md` and link it from the main document. Preserve separate headings and source information for each transcript.
- Copy referenced images/audio/included resource files into an `assets/` folder and use relative Markdown links. Do not export absolute local paths or machine-specific user directories.
- Use Markdown image syntax for images and normal file links for audio, with captions and optional transcript text. Audio playback depends on the reader.
- Desktop saves a folder containing the main Markdown, history when present, and required assets. PHP downloads the same bundle as a ZIP. A text-only project without companion material may be downloaded as a single Markdown file.
- Show a pre-export summary of included sections, nodes, history documents, and media, plus missing-file errors. Fail atomically on missing required assets instead of silently publishing broken links.
- Use UTF-8 and stable formatting. The same project snapshot and export options must yield equivalent output across Rust and PHP, apart from declared nonsemantic fields such as export timestamps.

### 10.2 Storytrack structure

The Markdown is readable guidance, not generated book prose. Example shape:

```markdown
---
storytrack_format: 1
project_id: "<stable-id>"
project_name: "Example Book"
project_revision: 42
exported_at: "<ISO-8601 UTC>"
---

# Example Book — StoryTrack

## Project writing guidance
Style: lyrical
Tone: reflective
Mood: uneasy

## Weight guide
Importance: 1–5.5; higher means more important.
Liberty: 1–5.5; higher allows more deviation.
Transition sharpness: 0–100; higher means more abrupt.

## Section: Arrival

### Chapter 1: The Station
Pacing: slow (chapter override)
Tone: reflective (inherited)

#### Node: The empty platform
Node ID: <stable-id>
Importance: 3.0
Liberty: 1.0
Beginning sharpness: 50 (moderate)
Ending sharpness: 50 (moderate)

The train arrives, but nobody is waiting.

![Station reference](assets/<asset-id>.png)

[Historical context](Example%20Book-history.md)
```

Escape metadata, headings, and relative URLs appropriately. Preserve intentional authored Markdown without executing embedded scripts or treating imported text as application commands. Include stable IDs and explicit hierarchy so repeated titles are unambiguous.

### 10.3 Editable project exchange

Provide a separate versioned `.storytracks` ZIP archive for backup and exchange between desktop and PHP. It contains a `project.json` manifest and managed assets, including templates, suspended content, trash, and user metadata. Export preview must explain that backups contain more material than a published storytrack.

The Markdown publication is not a lossless editable backup. Both editions must import/export the archive, validate schema versions and asset references, and preserve IDs for round trips. Importing an archive whose project ID already exists offers open existing or import as an independent copy, never silent merging. Independent copies remap internal IDs and references consistently.

## 11. Data model and persistence

Minimum entities:

| Entity | Essential fields |
| --- | --- |
| Project | ID, schema version, revision, name, description, writing metadata, creation/update timestamps |
| Section | ID, project ID, title, sibling order, locked, suspended, trash metadata |
| Chapter | ID, section ID, title, sibling order, numbering mode/manual label, metadata overrides, state |
| Node placement | ID, chapter ID, sibling order, optional title/content or template reference, importance, liberty, beginning/ending sharpness, state |
| Content block | ID, owner ID/type, order, type (`text`, `image`, `audio`), text or asset reference, caption/alt text |
| Template | ID, project ID, name, content, default weights/sharpness, revision, description/tags |
| Side note | ID, project ID, scope/owner ID, text, publication inclusion flag |
| Resource | ID, project ID, kind, title, source metadata, text/asset reference, publication inclusion flag |
| Asset | ID, project ID, managed relative path, original filename, media type, byte size, content hash |
| UI state | Selected item, viewport, panel widths, outline expansion, filters; stored separately from authored content |

- Use stable UUIDs. Store timestamps in UTC and display them in the user's local time.
- Maintain exactly one canonical sibling ordering per parent; update moves and cross-parent changes transactionally.
- A node has either its own content or a linked template reference. Resolve template content without copying it on every save.
- Enforce ownership, valid parent types, non-cyclic hierarchy, weight ranges, and valid template/asset references in the backend.
- Trash metadata records deletion time, original parent/order, and a deletion group so restoring a parent does not resurrect children trashed independently earlier.
- Autosave text after a short debounce (target 500 ms); persist structural changes immediately. Flush pending edits before project navigation and publish.
- Make node moves, imports, metadata changes, and template operations undoable as logical actions. Keep at least 100 actions in the current editing session; persistent undo across restarts is optional.
- Serialize writes and use a project revision for optimistic concurrency. Reject stale writes with a recoverable conflict message; never silently overwrite edits from another window/tab.
- Recover the last committed state after a crash. Failed saves retain unsaved content in the active session and provide retry/export recovery options.
- Back up data before schema migration. Never downgrade or overwrite a project from a newer unsupported schema.
- Keep SQLite databases on local application/server storage rather than inside a live cloud-synchronized folder; use portable archives for transfer and backups.

## 12. Security, accessibility, and quality

- Desktop reads/writes only user-selected locations and managed application data through constrained Rust commands. Do not expose arbitrary shell execution through the interface.
- Render imported content safely; disable executable HTML/scripts, reject dangerous URL schemes, and do not fetch remote media automatically. External links open only through explicit user action.
- Validate upload types and sizes, protect archive extraction against path traversal and oversized expansion, and retain original filenames only as metadata.
- PHP requires authenticated file/API access, CSRF protection for mutations, secure password hashing, secure cookie settings for HTTPS deployments, and prepared database queries.
- Do not send project content, transcripts, telemetry, or crash details to external services automatically.
- Make all primary operations keyboard accessible. Provide visible focus, descriptive labels for icon buttons including the eye/cog, and keyboard alternatives for drag operations.
- Communicate locked, suspended, saving, and error states with text/icons as well as color.
- Provide a usable outline/text editing path without requiring precise canvas gestures. Preserve native text selection and audio controls.
- Proposed performance target: a 2,000-node, 100-chapter text project becomes editable within 3 seconds on the documented reference machine after application startup; common edits give visible feedback within 100 ms. Define and record reference hardware before performance acceptance.
- Virtualize off-screen nodes and lazy-load image/audio data. Large attachments must not block editing or load entirely into memory for playback unnecessarily.

## 13. Acceptance criteria

1. On a Windows test machine with networking disabled and no preinstalled WebView2 runtime, the packaged installer installs successfully; `StoryTracks.exe` can create, edit, close, reopen, and publish a media-containing project.
2. A clean PHP deployment from `dist/php` works with only its documented PHP/server requirements and no Rust/Node/build tools. It completes the same core authoring flow.
3. A user can create a project from the dashboard and reopen it with content, metadata, order, attachments, and last editor position preserved.
4. Reordering sections/chapters/nodes updates outline, canvas, automatic numbering, and publication consistently. Locked-subtree operations are rejected without partial mutation.
5. Collapsing does not alter exports; suspension excludes content by default; trash restores without data loss and never appears in a storytrack export.
6. Clicking a node's eye button brings its title/header into the unobscured canvas at readable zoom, including untitled nodes and temporary previews of suspended nodes.
7. Text, image, and audio blocks retain their order and content after save/reopen, archive transfer, and publish. Media remains available when original source files are moved.
8. New nodes start at importance 3.0, liberty 1.0, and beginning/ending sharpness 50. Both 1.0 and 5.5 endpoints survive editing, persistence, and export; invalid values are rejected.
9. Two placements of the same template can use different weights. Updating template defaults leaves existing weights unchanged. Updating linked content preserves placement-specific settings and honors locks.
10. Importing `First line\nsecond line\n\nThird paragraph` creates two nodes; the first retains its single line break. CRLF, whitespace-only blank lines, and repeated blank lines produce equivalent results without empty nodes.
11. Transcript import creates a historical resource, not narrative nodes. Publication includes its preserved text in `(project name)-history.md` and a working relative link from `(project name)-st.md`.
12. Chapter metadata displays inherited/effective values correctly and publishes explicit overrides without rewriting node text.
13. Publish preview matches output inclusion. Included image/audio/history links resolve within the exported bundle, and failed publication leaves no misleading partial final export.
14. Desktop-to-PHP-to-desktop archive round trips preserve all authored content, weights, templates, metadata, attachment hashes, order, suspension, and trash states.
15. Shared fixtures verify Rust/PHP parity for validation, text splitting, state handling, numbering, template resolution, metadata inheritance, and normalized Markdown output.
16. Interrupted saves, disk-full failures, stale revisions, invalid archives, and schema migration failures do not corrupt the last valid project or silently discard edits.
17. Primary project, outline, node, metadata, and publishing actions work by keyboard; the 2,000-node performance target is measured on recorded hardware.

## 14. Implementation sequence

1. **Foundation:** versioned schemas and parity fixtures; Rust domain/persistence; PHP transport/persistence; shared interface shell; minimal packaging for both editions.
2. **Core authoring:** dashboard, project lifecycle, hierarchy, synchronized vertical canvas, rich media blocks, autosave, undo, locks, suspension, and trash.
3. **Writing controls:** project/chapter guidance, node settings, reusable templates, side notes, resources, and quick import.
4. **Exchange and publication:** historical transcripts, Markdown/media bundles, portable archives, conflict handling, and cross-edition conformance.
5. **Release readiness:** accessibility, large-project performance, crash recovery, deployment checks, and verified offline Windows installation.

Initial release excludes cloud synchronization, real-time collaboration, automatic book writing, audio transcription, arbitrary graph branching, EPUB/PDF/typesetting, and plugin marketplaces. These may be added later without making the offline authoring workflow dependent on external services.
