# StoryTracks PHP edition

Requires PHP 8.2 or newer with PDO, PDO_SQLITE, JSON, hash, iconv, and session. No Composer, Rust, Node, ZipArchive, or frontend build tools are needed on the deployment server. Assets, fonts (system fonts), and scripts are served locally. This build was exercised with PHP 8.2.12; additional PHP versions have not been tested in this workspace.

1. Copy `config.example.php` to `config.php` and set an absolute `data_dir` outside the web root and outside OneDrive/Dropbox/cloud-sync directories.
2. Set `password_hash` using PHP's `password_hash`. A password is mandatory for remote requests. An unconfigured installation permits loopback access only.
3. Point your web server's document root to **public/**. Never serve the package root.
4. Use HTTPS remotely. Set PHP `post_max_size=150M`, `memory_limit=512M`, and `max_execution_time=120` for larger archives/media projects.
5. For local use: `php -S 127.0.0.1:8080 -t public`. Open `http://127.0.0.1:8080`.

SQLite and content-addressed media files are created in `data_dir`. Back up the entire directory while the server is stopped, or export `.storytracks` archives. SQLite database format is versioned by `PRAGMA user_version`. No destructive migration is performed automatically. All requests use same-origin session authentication; mutations require a CSRF token. Application errors are returned as JSON, and filesystem details are kept out of responses. An API fixture runner lives in `tests/php-fixtures.php` in the source repository.

PHP publishes Markdown and history from a stored snapshot with an explicit revision check. The browser packages that output and its attachments into a ZIP. Editable `.storytracks` archive conversion runs in the shared client; PHP independently validates imported writes, references, media hashes, locks, and optimistic revisions before committing them. Attachments are limited to 25 MB each and 100 MB total per project and are stored outside public/. Missing managed files remain visible as placeholders; restore a complete portable backup before saving or publishing affected content.

The default storage location uses `STORYTRACKS_DATA_DIR`, otherwise the operating system's local data directory. Set an explicit `data_dir` for a hosted server and grant the PHP process write access. The installer package contains no configured password; a local `config.php` is deliberately excluded from generated ZIPs.
