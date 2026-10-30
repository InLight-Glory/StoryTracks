# StoryTracks PHP edition

Requires PHP 8.2–8.4 with PDO_SQLITE, JSON, hash, and session. No Composer, Rust or Node is needed on the deployment server. Assets, fonts (system fonts), and scripts are served locally. The build was exercised with PHP 8.2.12; use a patched PHP release for hosting.

1. Copy `config.example.php` to `config.php` and set an absolute `data_dir` outside the web root and outside OneDrive/Dropbox/cloud-sync directories.
2. Set `password_hash` using PHP's `password_hash`. A password is mandatory for remote requests. An unconfigured installation permits loopback access only.
3. Point your web server's document root to **public/**. Never serve the package root.
4. Use HTTPS remotely. Set PHP `post_max_size=150M`, `memory_limit=512M`, and `max_execution_time=120` for larger archives/media projects.
5. For local use: `php -S 127.0.0.1:8080 -t public`. Open `http://127.0.0.1:8080`.

SQLite and content-addressed media files are created in `data_dir`. Back up the entire directory while the server is stopped, or export `.storytracks` archives. SQLite database format is versioned by `PRAGMA user_version`. No destructive migration is performed automatically. All requests use same-origin session authentication; mutations require a CSRF token. Application errors are returned as JSON, and filesystem details are kept out of responses. An API fixture runner lives in `tests/php-fixtures.php` in the source repository.

Publication and archive conversion currently run in the shared client. PHP independently validates all project writes, references, media hashes, locks, and optimistic revisions, and stores media outside public/. See the root implementation status for remaining release acceptance work.
