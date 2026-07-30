import { createServer } from "node:http";
import { access, mkdir, readFile, readdir, rename, unlink, utimes, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { spawn } from "node:child_process";
import matter from "gray-matter";

const projectRoot = process.cwd();
const contentDir = join(projectRoot, "src", "content", "problems");
const topicContentDir = join(projectRoot, "src", "content", "topics");
const solutionsDir = join(projectRoot, "solutions");
const editorDir = join(projectRoot, "tools", "problem-editor");
const topicEditorDir = join(projectRoot, "tools", "topic-editor");
const topicBuildScript = join(projectRoot, "scripts", "build-topic-pdfs.mjs");
const contentConfigPath = join(projectRoot, "src", "content.config.ts");
const port = Number(process.env.PROBLEM_EDITOR_PORT || 4322);
const idPattern = /^[a-z0-9][a-z0-9-]*$/;
const topicIdPattern = /^[\p{L}\p{N}][\p{L}\p{N}-]*$/u;
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
await mkdir(topicContentDir, { recursive: true });
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

function normalizeTopicName(value) {
  return String(value || "").toLocaleLowerCase().replace(/[\s_-]+/g, "");
}

function assertTopicId(id) {
  if (!topicIdPattern.test(id)) throw new Error("无效的专题标识");
}

function topicIdFrom(value) {
  const id = String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const normalized = /^[\x00-\x7F]+$/.test(id) ? id.toLocaleLowerCase() : id;
  assertTopicId(normalized);
  return normalized;
}

function runTopicPdf(id) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [topicBuildScript, id], {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) return resolve(output);
      reject(new Error(output.trim() || "PDF 生成失败"));
    });
  });
}

function assertProblem(input) {
  const title = String(input.title || "").trim();
  const url = String(input.url || "").trim();
  const platform = String(input.platform || "").trim();
  const solvedAt = String(input.solvedAt || "").trim();
  const statement = String(input.statement || "").replace(/\r\n/g, "\n").trim();
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

  return { title, url, platform, solvedAt, tags, statement, idea, code, language };
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

async function listUsedTags() {
  const [problems, topics] = await Promise.all([listProblems(), listTopics()]);
  const counts = new Map();
  const entries = topics.map((topic) => ({
    name: topic.title,
    aliases: topic.aliases,
    count: 0,
  }));

  for (const problem of problems) {
    for (const tag of new Set(problem.tags)) {
      const matched = entries.find((entry) =>
        [entry.name, ...entry.aliases]
          .some((name) => normalizeTopicName(name) === normalizeTopicName(tag))
      );
      if (matched) matched.count += 1;
      else counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  entries.push(...[...counts.entries()].map(([name, count]) => ({
    name,
    aliases: [],
    count,
  })));
  return entries
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"))
    .map(({ name, aliases, count }) => ({
      name,
      aliases,
      count,
      group: count > 0 ? `${count} 道题` : "知识点",
    }));
}

async function listTopics() {
  const files = (await readdir(topicContentDir)).filter((file) => file.endsWith(".md"));
  return Promise.all(files.map(async (file) => {
    const id = file.slice(0, -3);
    const parsed = matter(await readFile(join(topicContentDir, file), "utf8"));
    return {
      id,
      title: String(parsed.data.title || id),
      summary: String(parsed.data.summary || ""),
      group: String(parsed.data.group || "未分类"),
      aliases: Array.isArray(parsed.data.aliases) ? parsed.data.aliases.map(String) : [],
      updatedAt: formatInputDate(parsed.data.updatedAt),
      order: Number(parsed.data.order || 0),
    };
  }));
}

async function listTopicEntries() {
  const [tags, topics] = await Promise.all([listUsedTags(), listTopics()]);
  return tags.map((tag) => {
    const topic = topics.find((entry) =>
      [entry.title, ...entry.aliases]
        .some((name) => normalizeTopicName(name) === normalizeTopicName(tag.name))
    );
    return {
      ...tag,
      topicId: topic?.id ?? "",
      summary: topic?.summary ?? "",
      updatedAt: topic?.updatedAt ?? "",
      order: topic?.order ?? 0,
    };
  });
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
    statement: String(parsed.data.statement || ""),
    language: parsed.data.language ?? "cpp",
    idea: parsed.content.trim(),
    code,
  };
}

async function readTopic(id) {
  assertTopicId(id);
  const parsed = matter(await readFile(join(topicContentDir, `${id}.md`), "utf8"));
  return {
    id,
    title: String(parsed.data.title || ""),
    summary: String(parsed.data.summary || ""),
    group: String(parsed.data.group || ""),
    aliases: Array.isArray(parsed.data.aliases) ? parsed.data.aliases.map(String) : [],
    updatedAt: formatInputDate(parsed.data.updatedAt),
    order: Number(parsed.data.order || 0),
    draft: parsed.data.draft === true,
    content: parsed.content.trim(),
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
    statement: input.statement,
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

function topicSummaryFrom(content, title) {
  const firstParagraph = content
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/\$\$[\s\S]*?\$\$/g, "\n")
    .split("\n")
    .filter((line) => !/^#{1,6}\s+/.test(line))
    .map((line) => line
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+\.\s+/, "")
      .replace(/!\[[^\]]*]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/[`*_~]/g, "")
      .replace(/\$([^$]+)\$/g, "$1")
      .trim())
    .find((line) => line && !line.startsWith("|"));
  if (!firstParagraph) return `「${title}」的知识、常见写法与模板。`;
  return firstParagraph.length > 72
    ? `${firstParagraph.slice(0, 72).trim()}…`
    : firstParagraph;
}

async function saveTopic(rawInput) {
  const tag = String(rawInput.tag || "").trim();
  const content = String(rawInput.content || "").replace(/\r\n/g, "\n").trim();
  const originalId = String(rawInput.originalId || "").trim();
  if (!tag) throw new Error("请先选择一个标签");
  if (!content) throw new Error("请填写知识点");
  if (originalId) assertTopicId(originalId);

  const [knownTags, topics] = await Promise.all([
    listUsedTags(),
    listTopics(),
  ]);
  const matchingTopic = topics.find((topic) =>
    [topic.title, ...topic.aliases]
      .some((name) => normalizeTopicName(name) === normalizeTopicName(tag))
  );
  if (!originalId && matchingTopic) {
    throw new Error("这个标签已经有知识点，请从左侧列表打开");
  }
  const knownTag = knownTags.find((item) =>
    [item.name, ...(item.aliases || [])]
      .some((name) => normalizeTopicName(name) === normalizeTopicName(tag))
  );

  const previousPath = originalId ? join(topicContentDir, `${originalId}.md`) : "";
  const previousSource = originalId
    ? await readFile(previousPath, "utf8")
    : null;
  const previous = previousSource === null ? null : matter(previousSource);
  const title = String(previous?.data.title || knownTag?.name || tag);
  const id = originalId || topicIdFrom(title);
  const markdownPath = join(topicContentDir, `${id}.md`);

  if (!originalId && await exists(markdownPath)) {
    throw new Error("这个标签已经有知识点，请从左侧重新打开");
  }

  const nextOrder = Math.max(0, ...topics.map((topic) => Number(topic.order || 0))) + 1;
  const frontmatter = {
    title,
    summary: String(previous?.data.summary || topicSummaryFrom(content, title)),
    group: String(previous?.data.group || "算法笔记"),
    aliases: Array.isArray(previous?.data.aliases)
      ? previous.data.aliases.map(String)
      : (knownTag?.aliases || []),
    updatedAt: new Date().toISOString().slice(0, 10),
    order: Number(previous?.data.order ?? nextOrder),
    draft: false,
  };
  const markdown = matter.stringify(`${content}\n`, frontmatter);
  const markdownTemp = `${markdownPath}.tmp`;

  await writeFile(markdownTemp, markdown, "utf8");
  await rename(markdownTemp, markdownPath);

  try {
    await runTopicPdf(id);
  } catch (error) {
    if (previousSource === null) {
      await unlink(markdownPath).catch(() => {});
    } else {
      await writeFile(markdownPath, previousSource, "utf8");
    }
    throw new Error(`PDF 生成失败，专题修改已撤回：${error.message}`);
  }

  const refreshTime = new Date();
  await utimes(contentConfigPath, refreshTime, refreshTime);
  return { id, title, updatedAt: frontmatter.updatedAt, pdf: `/topics/${id}.pdf` };
}

async function deleteTopic(id) {
  assertTopicId(id);
  const markdownPath = join(topicContentDir, `${id}.md`);
  const parsed = matter(await readFile(markdownPath, "utf8"));
  const title = String(parsed.data.title || id);
  const aliases = Array.isArray(parsed.data.aliases) ? parsed.data.aliases.map(String) : [];
  const referencedBy = (await listProblems()).filter((problem) =>
    problem.tags.some((tag) =>
      [title, ...aliases]
        .some((name) => normalizeTopicName(name) === normalizeTopicName(tag))
    )
  );
  if (referencedBy.length > 0) {
    throw new Error(`有 ${referencedBy.length} 道题正在使用「${title}」，不能删除`);
  }

  await unlink(markdownPath);
  await unlink(join(projectRoot, "public", "topics", `${id}.pdf`)).catch(() => {});
  const refreshTime = new Date();
  await utimes(contentConfigPath, refreshTime, refreshTime);
  return { id, title };
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
    const routePath = requestUrl.pathname
      .replace(/^\/topic-editor\/api/, "/api")
      .replace(/^\/editor\/api/, "/api");
    if (request.method === "GET" && routePath === "/api/problems") {
      return sendJson(response, 200, await listProblems());
    }
    if (request.method === "GET" && routePath === "/api/tags") {
      return sendJson(response, 200, await listUsedTags());
    }
    if (request.method === "GET" && routePath === "/api/topics") {
      return sendJson(response, 200, await listTopicEntries());
    }
    if (request.method === "GET" && routePath.startsWith("/api/topics/")) {
      const id = decodeURIComponent(routePath.slice("/api/topics/".length));
      return sendJson(response, 200, await readTopic(id));
    }
    if (request.method === "GET" && routePath.startsWith("/api/problems/")) {
      const id = decodeURIComponent(routePath.slice("/api/problems/".length));
      return sendJson(response, 200, await readProblem(id));
    }
    if (request.method === "POST" && routePath === "/api/problems") {
      return sendJson(response, 200, await saveProblem(await parseBody(request)));
    }
    if (request.method === "POST" && routePath === "/api/topics") {
      return sendJson(response, 200, await saveTopic(await parseBody(request)));
    }
    if (request.method === "DELETE" && routePath.startsWith("/api/topics/")) {
      const id = decodeURIComponent(routePath.slice("/api/topics/".length));
      return sendJson(response, 200, await deleteTopic(id));
    }

    const topicEditorRequest = requestUrl.pathname === "/topic-editor"
      || requestUrl.pathname.startsWith("/topic-editor/");
    const problemEditorRequest = requestUrl.pathname.startsWith("/editor/");
    const relativePath = topicEditorRequest
      ? requestUrl.pathname.replace(/^\/topic-editor\/?/, "")
      : problemEditorRequest
        ? requestUrl.pathname.replace(/^\/editor\/?/, "")
        : requestUrl.pathname.slice(1);
    const fileName = relativePath || "index.html";
    if (!["index.html", "editor.css", "editor.js"].includes(fileName)) {
      response.writeHead(404);
      return response.end("Not found");
    }
    const file = await readFile(join(topicEditorRequest ? topicEditorDir : editorDir, fileName));
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
