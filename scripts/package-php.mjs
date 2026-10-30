import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir("dist/php/public", { recursive: true });
await cp("dist/web", "dist/php/public", { recursive: true });
await cp("apps/php", "dist/php", { recursive: true });
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
