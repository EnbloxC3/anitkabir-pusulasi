import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "src", "fonts");

const sources = [
  {
    name: "framework7-icons",
    path: path.join(root, "node_modules", "framework7-icons", "fonts"),
  },
  {
    name: "material-icons",
    path: path.join(root, "node_modules", "material-icons", "iconfont"),
  },
  {
    name: "material-symbols",
    path: path.join(root, "node_modules", "material-symbols"),
  },
];

const fontExtensions = new Set([".woff", ".woff2", ".ttf", ".otf", ".eot"]);

async function copyFonts(source, target) {
  await fs.mkdir(target, { recursive: true });

  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);

    if (entry.isDirectory()) {
      await copyFonts(sourcePath, target);
      continue;
    }
    if (!entry.isFile()) continue;

    const extension = path.extname(entry.name).toLowerCase();

    if (!fontExtensions.has(extension)) continue;
    await fs.copyFile(sourcePath, path.join(target, entry.name));
  }
}

for (const source of sources) {
  const target = path.join(destination, source.name);
  await copyFonts(source.path, target);
}
