import { copyFile, mkdir, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const files = [
  { from: resolve(root, "../legacy/UICALC.cbl"), to: resolve(root, "public/legacy/UICALC.cbl") },
  { from: resolve(root, "../modern/calculator.py"), to: resolve(root, "public/modern/calculator.py") },
  ...["M1", "M2", "M3", "M4", "M5"].map((id) => ({
    from: resolve(root, `../backend/patches/fix-${id}.patch`),
    to: resolve(root, `public/patches/fix-${id}.patch`),
  })),
  { from: resolve(root, "../LICENSE"), to: resolve(root, "public/LICENSE") },
  { from: resolve(root, "../THIRD_PARTY_NOTICES.md"), to: resolve(root, "public/THIRD_PARTY_NOTICES.md") },
  ...["GPL-3.0", "LGPL-3.0", "LGPL-2.1"].map((id) => ({
    from: resolve(root, `../licenses/${id}.txt`),
    to: resolve(root, `public/licenses/${id}.txt`),
  })),
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
