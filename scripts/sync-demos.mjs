import { cp, mkdir, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const sourceRoot = join(homedir(), "courses", "Algorithm");
const targetRoot = join(process.cwd(), "public", "demos");

const experiments = [
  { source: "exp2/output", slug: "closest-pair", dataFrom: "exp2" },
  { source: "exp3/visualization", slug: "graph-coloring" },
  { source: "exp4/visualization", slug: "egg-drop" },
  { source: "exp5/visualization", slug: "bridge" },
  { source: "exp6/visualization", slug: "maxflow" },
];

const companionExtensions = new Set([".json", ".jsonl", ".js"]);

for (const experiment of experiments) {
  const sourceDir = join(sourceRoot, experiment.source);
  const targetDir = join(targetRoot, experiment.slug);
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
