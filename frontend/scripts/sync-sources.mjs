import { copyFile, mkdir, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const files = [
  { from: resolve(root, "../legacy/UICALC.cbl"), to: resolve(root, "public/legacy/UICALC.cbl") },
  { from: resolve(root, "../modern/calculator.py"), to: resolve(root, "public/modern/calculator.py") },
];

for (const file of files) {
  try {
    await access(file.from);
  } catch {
    console.warn(`sync-sources: missing ${file.from}, skipped`);
    continue;
  }
  await mkdir(dirname(file.to), { recursive: true });
  await copyFile(file.from, file.to);
  console.log(`sync-sources: copied ${file.from}`);
}
