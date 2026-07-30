import { spawn } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { basename, join } from "node:path";
import matter from "gray-matter";

const projectRoot = process.cwd();
const topicsDir = join(projectRoot, "src", "content", "topics");
const templatePath = join(projectRoot, "templates", "topic.tex");
const publicDir = join(projectRoot, "public", "topics");
const tempRoot = join(projectRoot, "tmp", "pdfs");
const requestedIds = new Set(process.argv.slice(2));

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", (error) => reject(new Error(
      `无法执行 ${command}：${error.message}`,
    )));
    child.on("close", (code) => {
      if (code === 0) return resolve(output);
      reject(new Error(`${command} 执行失败：\n${output.trim()}`));
    });
  });
}

async function buildTopic(markdownPath) {
  const id = basename(markdownPath, ".md");
  const source = await readFile(markdownPath, "utf8");
  const parsed = matter(source);
  if (parsed.data.draft === true) return null;

  for (const field of ["title", "summary", "group", "updatedAt"]) {
    if (!parsed.data[field]) throw new Error(`${id}.md 缺少 ${field}`);
  }

  const topicTempDir = join(tempRoot, id);
  const texPath = join(topicTempDir, `${id}.tex`);
  const builtPdfPath = join(topicTempDir, `${id}.pdf`);
  const outputPdfPath = join(publicDir, `${id}.pdf`);

  await rm(topicTempDir, { recursive: true, force: true });
  await mkdir(topicTempDir, { recursive: true });

  await run("pandoc", [
    markdownPath,
    "--from=markdown+yaml_metadata_block+tex_math_dollars+pipe_tables",
    "--to=latex",
    "--standalone",
    `--template=${templatePath}`,
    "--highlight-style=tango",
    "--top-level-division=section",
    "--shift-heading-level-by=-1",
    `--output=${texPath}`,
  ]);

  await run("xelatex", [
    "-interaction=nonstopmode",
    "-halt-on-error",
    `-output-directory=${topicTempDir}`,
    texPath,
  ]);

  if (!await exists(builtPdfPath)) {
    throw new Error(`${id} 没有生成 PDF`);
  }

  await copyFile(builtPdfPath, outputPdfPath);
  await rm(topicTempDir, { recursive: true, force: true });
  return outputPdfPath;
}

await mkdir(publicDir, { recursive: true });
await mkdir(tempRoot, { recursive: true });

const markdownFiles = (await readdir(topicsDir))
  .filter((file) => file.endsWith(".md"))
  .filter((file) => requestedIds.size === 0 || requestedIds.has(basename(file, ".md")))
  .sort();

if (requestedIds.size > 0 && markdownFiles.length !== requestedIds.size) {
  const found = new Set(markdownFiles.map((file) => basename(file, ".md")));
  const missing = [...requestedIds].filter((id) => !found.has(id));
  throw new Error(`找不到专题：${missing.join(", ")}`);
}

if (markdownFiles.length === 0) {
  console.log("没有需要生成的专题 PDF。");
} else {
  for (const file of markdownFiles) {
    const output = await buildTopic(join(topicsDir, file));
    if (output) console.log(`已生成 ${output.slice(projectRoot.length + 1)}`);
  }
}

await rm(tempRoot, { recursive: true, force: true });
