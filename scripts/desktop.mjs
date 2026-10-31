import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { resolve, join, delimiter } from "node:path";
const root = resolve(import.meta.dirname, "..");
const cargo = join(root, ".local", "toolchain", "cargo");
if (existsSync(cargo)) {
  process.env.CARGO_HOME = cargo;
  process.env.RUSTUP_HOME = join(root, ".local", "toolchain", "rustup");
  process.env.PATH = join(cargo, "bin") + delimiter + process.env.PATH;
}
const mode = process.argv[2] || "dev";
const cli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
const child = spawnSync(
  process.execPath,
  [
    cli,
    mode,
    "--config",
    "apps/desktop/tauri.conf.json",
    ...process.argv.slice(3),
  ],
  { cwd: root, stdio: "inherit", env: process.env },
);
if (child.status !== 0) process.exit(child.status || 1);
if (mode === "build") {
  mkdirSync(join(root, "dist", "windows"), { recursive: true });
  copyFileSync(
    join(root, "target", "release", "StoryTracks.exe"),
    join(root, "dist", "windows", "StoryTracks.exe"),
  );
  const bundle = join(root, "target", "release", "bundle", "nsis");
  if (existsSync(bundle)) {
    const file = readdirSync(bundle).find((x) => x.endsWith("-setup.exe"));
    if (file)
      copyFileSync(
        join(bundle, file),
        join(root, "dist", "windows", "StoryTracks-setup.exe"),
      );
  }
  console.log("Windows artifacts copied to dist/windows.");
}
