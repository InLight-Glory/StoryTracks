# StoryTracks

An offline story outlining workspace built from [spec.md](spec.md), with a Rust/Tauri Windows application and a PHP edition sharing the React interface. Organize a book on a vertical canvas, keep writing guidance and historical context alongside it, and publish portable Markdown.

## Run the built application

- `dist/windows/StoryTracks-setup.exe`: Windows installer, including the offline WebView2 runtime.
- `dist/windows/StoryTracks.exe`: application executable; requires an installed WebView2 runtime.
- `dist/StoryTracks-php.zip`: deployable PHP package. Extract it and follow its README; serve **only** its `public/` directory.

Desktop projects live under `%LOCALAPPDATA%/com.storytracks.desktop/`, outside this checkout. The database and managed attachments are local; no external service or login is needed. The browser development preview uses its own IndexedDB storage, separate from desktop and PHP. To transfer a project, export a `.storytracks` backup and import it in the other edition.

The first launch opens a sample story. Use **My projects → New project** for your own work. Click a node title to edit it, use the eye icon to bring it into view, and open its settings for weights, transitions, lock/suspend controls, and keyboard-accessible move actions. **Publish** exports a readable snapshot; **Backup** preserves the editable project, templates, suspended content, trash, and attachments.

The peach canvas has three areas: **Sub-context** on the left, the main story in the center, and **Highlight** on the right. Select a node to see its connected notes: Sub-context holds the author's thoughts and feelings; Highlight holds commentary and comments. Both areas identify their connected node, allow reassignment, and respect node locks. Notes travel with backups and can be individually included in publication; suspended or trashed nodes' notes follow the same inclusion rules as their node. Earlier project-wide cards remain under **Unlinked notes** until you choose a node for them.

New projects can start from **Hero’s journey, Science fiction, Mystery, Self-help, Fantasy, or Memoir** templates. Each creates chapter headings and a guided workbook of questions to answer. Use the left panel's **Project guide** tab to answer prompts, add other guides without replacing existing work, and send an answer to an outline chapter.

The left panel also includes **World building** (places, cultures, history, institutions, technology/magic, daily life, and beliefs) and **Questions**. The latter is the **What was the question?** system: enter a statement or quote with attribution, generate editable question starters, select or write the underlying question, explore insights and alternative answers, identify readers who share the question, and draft a marketing hook. Suggestions use local language patterns; they are hypotheses for you to refine, not AI analysis or claims about the source author's intentions. All planning content autosaves, supports undo, travels in backups, and has explicit publication inclusion controls.

## Develop and build

Frontend prerequisites: Node.js 22+ and npm. Windows desktop builds also require Rust stable, the MSVC C++ build tools/Windows SDK, and WebView2 for development. The desktop script uses a workspace-local Rust toolchain under `.local/toolchain/` when present, otherwise the toolchain on PATH. Dependencies must be downloaded before offline builds.

```powershell
npm ci
npm run dev             # browser development preview, 127.0.0.1:5173
npm run desktop:dev     # native development application
npm run build           # production UI, dist/php, and dist/StoryTracks-php.zip
npm run desktop:build   # production UI, Windows executable and NSIS installer
```

Close a running `target/release/StoryTracks.exe` before rebuilding: Windows locks executable files in use. The Windows installer contains an offline WebView2 installer, so its size is substantially larger than the application executable. These development artifacts are unsigned.

```powershell
npm test                         # TypeScript domain/archive/publication tests
npm run schema                   # regenerate the versioned JSON schema
cargo test -p storytracks-core    # Rust validation/publication/persistence tests
php tests/php-fixtures.php        # PHP shared conformance and SQLite checks
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
| `apps/desktop` | Native commands, selected-folder exports, Tauri/NSIS configuration |
| `apps/php` | Authenticated API, PHP validation/persistence/publication, deployment instructions |
| `contracts` | Versioned JSON schema and shared publication/import fixtures |
| `tests` | Domain, browser, and PHP acceptance checks |

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for verified behavior and remaining release acceptance work. The product specification is preserved in [spec.md](spec.md).
