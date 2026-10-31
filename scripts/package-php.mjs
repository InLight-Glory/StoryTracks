import { cp, mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import JSZip from "jszip";
const packageRoot = resolve("dist/php");
const generatedAssets = resolve(packageRoot, "public/assets");
if (
  !generatedAssets.startsWith(packageRoot + "\\") &&
  !generatedAssets.startsWith(packageRoot + "/")
)
  throw new Error("Invalid generated asset path");
await rm(generatedAssets, { recursive: true, force: true });
await mkdir("dist/php/public", { recursive: true });
await cp("dist/web", "dist/php/public", { recursive: true });
await cp("apps/php", "dist/php", {
  recursive: true,
  filter: (path) => basename(path) !== "config.php",
});
const html = await readFile("dist/php/public/index.html", "utf8");
await writeFile(
  "dist/php/public/index.html",
  html.replace("<head>", '<head><script src="./runtime.js"></script>'),
);
await writeFile(
  "dist/php/public/runtime.js",
  "window.STORYTRACKS_PHP = true;\n",
);
console.log(
  "PHP distribution created in dist/php. Serve only dist/php/public.",
);
const zip = new JSZip();
async function addDirectory(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "config.php") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory())
      await addDirectory(path, prefix + entry.name + "/");
    else zip.file(prefix + entry.name, await readFile(path));
  }
}
await addDirectory(packageRoot);
await writeFile(
  "dist/StoryTracks-php.zip",
  await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
);
