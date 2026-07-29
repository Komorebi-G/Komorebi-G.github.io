import { createServer } from "node:http";
import { access, mkdir, readFile, readdir, rename, unlink, utimes, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { spawn } from "node:child_process";
import matter from "gray-matter";

const projectRoot = process.cwd();
const contentDir = join(projectRoot, "src", "content", "problems");
const solutionsDir = join(projectRoot, "solutions");
const editorDir = join(projectRoot, "tools", "problem-editor");
const contentConfigPath = join(projectRoot, "src", "content.config.ts");
const port = Number(process.env.PROBLEM_EDITOR_PORT || 4322);
const idPattern = /^[a-z0-9][a-z0-9-]*$/;
const languageExtensions = {
  cpp: "cpp",
  c: "c",
  python: "py",
  java: "java",
  javascript: "js",
  typescript: "ts",
  rust: "rs",
  text: "txt",
};

await mkdir(contentDir, { recursive: true });
await mkdir(solutionsDir, { recursive: true });

function sendJson(response, status, data) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

async function parseBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 4_000_000) throw new Error("请求内容过大");
  }
  return JSON.parse(raw || "{}");
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function assertProblem(input) {
  const title = String(input.title || "").trim();
  const url = String(input.url || "").trim();
  const platform = String(input.platform || "").trim();
  const solvedAt = String(input.solvedAt || "").trim();
  const idea = String(input.idea || "").trim();
  const code = String(input.code || "").replace(/\r\n/g, "\n").trimEnd();
  const language = String(input.language || "cpp");
  const tags = [...new Set((Array.isArray(input.tags) ? input.tags : [])
    .map((tag) => String(tag).trim())
    .filter(Boolean))];

  if (!title) throw new Error("请填写题目名称");
  try {
    new URL(url);
  } catch {
    throw new Error("请输入完整有效的原题链接");
  }
  if (!platform) throw new Error("请填写题目平台");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(solvedAt)) throw new Error("请选择完成日期");
  if (tags.length === 0) throw new Error("请至少选择一个标签");
  if (!idea) throw new Error("请填写解题思路");
  if (!code) throw new Error("请填写代码");
  if (!languageExtensions[language]) throw new Error("不支持该代码语言");

  return { title, url, platform, solvedAt, tags, idea, code, language };
}

async function getNextProblemId(solvedAt) {
  const datePrefix = solvedAt.replaceAll("-", "");
  const files = (await readdir(contentDir)).filter((file) => file.endsWith(".md"));
  let largestSequence = 0;

  for (const file of files) {
    const match = file.slice(0, -3).match(new RegExp(`^${datePrefix}-(\\d+)$`));
    if (match) largestSequence = Math.max(largestSequence, Number(match[1]));
  }

  return `${datePrefix}-${String(largestSequence + 1).padStart(2, "0")}`;
}

async function listProblems() {
  const files = (await readdir(contentDir)).filter((file) => file.endsWith(".md"));
  const problems = await Promise.all(files.map(async (file) => {
    const id = file.slice(0, -3);
    const parsed = matter(await readFile(join(contentDir, file), "utf8"));
    return {
      id,
      title: parsed.data.title,
      platform: parsed.data.platform,
      solvedAt: formatInputDate(parsed.data.solvedAt),
      tags: parsed.data.tags ?? [],
      updatedAt: parsed.data.updatedAt,
    };
  }));
  return problems.sort((a, b) => String(b.solvedAt).localeCompare(String(a.solvedAt)));
}

async function readProblem(id) {
  if (!idPattern.test(id)) throw new Error("无效的题目标识");
  const markdownPath = join(contentDir, `${id}.md`);
  const parsed = matter(await readFile(markdownPath, "utf8"));
  const codeFile = parsed.data.code;
  const code = await readFile(join(solutionsDir, codeFile), "utf8").catch(() => "");
  return {
    id,
    title: parsed.data.title ?? "",
    url: parsed.data.url ?? "",
    platform: parsed.data.platform ?? "",
    solvedAt: formatInputDate(parsed.data.solvedAt),
    tags: parsed.data.tags ?? [],
    language: parsed.data.language ?? "cpp",
    idea: parsed.content.trim(),
    code,
  };
}

function formatInputDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

async function saveProblem(rawInput) {
  const input = assertProblem(rawInput);
  const originalId = String(rawInput.originalId || "").trim().toLowerCase();
  const editing = Boolean(originalId);
  if (editing && !idPattern.test(originalId)) throw new Error("已有题目标识无效");
  const id = editing ? originalId : await getNextProblemId(input.solvedAt);
  const markdownPath = join(contentDir, `${id}.md`);
  if (!editing && await exists(markdownPath)) throw new Error("题目标识生成冲突，请重新保存");

  let createdAt = new Date().toISOString();
  let oldCodeFile = "";
  if (editing) {
    const previous = matter(await readFile(markdownPath, "utf8"));
    createdAt = previous.data.createdAt instanceof Date
      ? previous.data.createdAt.toISOString()
      : String(previous.data.createdAt || createdAt);
    oldCodeFile = String(previous.data.code || "");
  }

  const extension = languageExtensions[input.language];
  const codeFile = `${id}.${extension}`;
  const now = new Date().toISOString();
  const frontmatter = {
    title: input.title,
    url: input.url,
    platform: input.platform,
    solvedAt: input.solvedAt,
    tags: input.tags,
    code: codeFile,
    language: input.language,
    createdAt,
    updatedAt: now,
    draft: false,
  };
  const markdown = matter.stringify(`${input.idea}\n`, frontmatter);
  const markdownTemp = `${markdownPath}.tmp`;
  const codePath = join(solutionsDir, codeFile);
  const codeTemp = `${codePath}.tmp`;

  await writeFile(markdownTemp, markdown, "utf8");
  await writeFile(codeTemp, `${input.code}\n`, "utf8");
  await rename(markdownTemp, markdownPath);
  await rename(codeTemp, codePath);

  if (editing && oldCodeFile && oldCodeFile !== codeFile) {
    await unlink(join(solutionsDir, oldCodeFile)).catch(() => {});
  }

  // Astro's glob loader does not always notice a brand-new Markdown file.
  // Touching the content config asks the dev server to resync the collection.
  const refreshTime = new Date();
  await utimes(contentConfigPath, refreshTime, refreshTime);

  return { id, updatedAt: now };
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host}`);
    if (request.method === "GET" && requestUrl.pathname === "/api/problems") {
      return sendJson(response, 200, await listProblems());
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/tags") {
      const tags = JSON.parse(await readFile(join(projectRoot, "src", "data", "tags.json"), "utf8"));
      return sendJson(response, 200, tags);
    }
    if (request.method === "GET" && requestUrl.pathname.startsWith("/api/problems/")) {
      const id = decodeURIComponent(requestUrl.pathname.slice("/api/problems/".length));
      return sendJson(response, 200, await readProblem(id));
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/problems") {
      return sendJson(response, 200, await saveProblem(await parseBody(request)));
    }

    const fileName = requestUrl.pathname === "/"
      ? "index.html"
      : requestUrl.pathname.slice(1);
    if (!["index.html", "editor.css", "editor.js"].includes(fileName)) {
      response.writeHead(404);
      return response.end("Not found");
    }
    const file = await readFile(join(editorDir, fileName));
    response.writeHead(200, { "content-type": contentTypes[extname(fileName)] });
    response.end(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    sendJson(response, 400, { error: message });
  }
});

server.listen(port, "127.0.0.1", () => {
  const editorUrl = `http://127.0.0.1:${port}`;
  console.log(`题目编辑器已启动：${editorUrl}`);
  console.log("按 Ctrl+C 停止。");

  if (!process.argv.includes("--no-open")) {
    const command = process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", editorUrl] : [editorUrl];
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  }
});
