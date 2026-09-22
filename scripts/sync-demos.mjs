import { access, cp, mkdir, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { demos } from "../src/data/demos.mjs";

const sourceRoot = join(homedir(), "courses", "Algorithm");
const targetRoot = join(process.cwd(), "public", "demos");

const companionExtensions = new Set([".json", ".jsonl", ".js"]);

for (const experiment of demos) {
  const sourceDir = join(sourceRoot, experiment.source);
  const targetDir = join(targetRoot, experiment.slug);
  try { await access(sourceDir); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    await access(join(targetDir, "index.html"));
    console.log(`using archived demo: ${experiment.slug}`);
    continue;
  }
  await mkdir(targetDir, { recursive: true });
  await cp(join(sourceDir, "index.html"), join(targetDir, "index.html"));

  const dataDir = experiment.dataFrom
    ? join(sourceRoot, experiment.dataFrom)
    : sourceDir;
  const files = await readdir(dataDir, { withFileTypes: true });

  for (const file of files) {
    if (!file.isFile()) continue;
    const extension = file.name.slice(file.name.lastIndexOf("."));
    if (!companionExtensions.has(extension)) continue;
    await cp(join(dataDir, file.name), join(targetDir, file.name));
  }

  console.log(`synced ${experiment.source} -> demos/${experiment.slug}`);
}
