import * as fs from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { problemInputSchema, problemSchema, topicSchema } from "../../src/lib/content-schema.mjs";
import { buildTagCatalog, contentId, createTagIndex } from "../../src/lib/tags.mjs";
import { languages } from "../../src/lib/languages.mjs";
import { readCollection } from "./content-files.mjs";
import { createQueue, writeTransaction } from "./file-transaction.mjs";

const inputDate = (value) => new Date(value).toISOString().slice(0, 10);

function safeId(value) {
  if (typeof value !== "string" || !/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(value)) throw new Error("无效的内容标识");
  return contentId(value);
}

export function topicSummaryFrom(content, title) {
  const paragraph = content.replace(/```[\s\S]*?```/g, "\n").replace(/\$\$[\s\S]*?\$\$/g, "\n")
    .split("\n").filter((line) => !/^#{1,6}\s+/.test(line))
    .map((line) => line.replace(/^[-*+]\s+|^\d+\.\s+/, "")
      .replace(/!\[[^\]]*]\([^)]*\)/g, "").replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/[`*_~]/g, "").replace(/\$([^$]+)\$/g, "$1").trim())
    .find((line) => line && !line.startsWith("|"));
  if (!paragraph) return `「${title}」的知识、常见写法与模板。`;
  return paragraph.length > 72 ? `${paragraph.slice(0, 72).trim()}…` : paragraph;
}

export function createContentStore(root, io = fs) {
  const problemDir = join(root, "src/content/problems");
  const topicDir = join(root, "src/content/problem-tags");
  const solutionsDir = join(root, "solutions");
  const queue = createQueue();
  const ready = Promise.all([problemDir, topicDir, solutionsDir].map((dir) => io.mkdir(dir, { recursive: true })));
  const allProblems = () => readCollection(problemDir, problemSchema, io);
  const allTopics = () => readCollection(topicDir, topicSchema, io);
  const topicRecords = (topics) => topics.map(({ id, data }) => ({ id, ...data }));

  async function refresh() {
    const now = new Date();
    // The content is already committed. A watcher failure must not report a failed save.
    await io.utimes(join(root, "src/content.config.ts"), now, now)
      .catch((error) => console.warn("内容已保存，开发服务需手动刷新：", error.message));
  }

  async function findRecord(directory, schema, id) {
    const canonicalId = safeId(id);
    const parsed = matter(await io.readFile(join(directory, `${canonicalId}.md`), "utf8"));
    return { id: canonicalId, data: schema.parse(parsed.data), body: parsed.content.trim() };
  }

  async function listProblems() {
    return (await allProblems()).map(({ id, data }) => ({
      id, title: data.title, platform: data.platform, solvedAt: inputDate(data.solvedAt),
      tags: data.tags, updatedAt: data.updatedAt, draft: data.draft,
    })).sort((a, b) => b.solvedAt.localeCompare(a.solvedAt) || b.id.localeCompare(a.id));
  }

  async function listTopicEntries() {
    const [problems, topics] = await Promise.all([allProblems(), allTopics()]);
    const records = topicRecords(topics);
    return buildTagCatalog(problems.map(({ data }) => data), records).map((entry) => {
      const topic = records.find((item) => item.id === entry.topicId);
      return { ...entry, group: entry.count ? `${entry.count} 道题` : "知识点",
        summary: topic?.summary ?? "", updatedAt: topic ? inputDate(topic.updatedAt) : "", order: topic?.order ?? 0 };
    });
  }

  async function readProblem(id) {
    const problem = await findRecord(problemDir, problemSchema, id);
    return { id: problem.id, ...problem.data, solvedAt: inputDate(problem.data.solvedAt), idea: problem.body,
      code: await io.readFile(join(solutionsDir, problem.data.code), "utf8") };
  }

  async function readTopic(id) {
    const topic = await findRecord(topicDir, topicSchema, id);
    return { id: topic.id, ...topic.data, updatedAt: inputDate(topic.data.updatedAt), content: topic.body };
  }

  async function saveProblem(raw) {
    const input = problemInputSchema.parse(raw);
    const [problems, topics] = await Promise.all([allProblems(), allTopics()]);
    const originalId = raw.originalId ? safeId(raw.originalId) : "";
    const previous = originalId ? problems.find((entry) => entry.id === originalId) : null;
    if (originalId && !previous) throw new Error("题目不存在，请刷新列表");
    const prefix = inputDate(input.solvedAt).replaceAll("-", "");
    const sequences = problems.map(({ id }) => id.match(new RegExp(`^${prefix}-(\\d+)$`)))
      .filter(Boolean).map((match) => Number(match[1]));
    const id = originalId || `${prefix}-${String(Math.max(0, ...sequences) + 1).padStart(2, "0")}`;
    const codeFile = `${id}.${languages[input.language].extension}`;
    if (problems.some((entry) => entry.id !== id && [codeFile, previous?.data.code].includes(entry.data.code))) {
      throw new Error("代码文件被其他题目引用，请先修正引用");
    }
    const now = new Date().toISOString();
    const data = {
      title: input.title, url: input.url, platform: input.platform, solvedAt: inputDate(input.solvedAt),
      tags: createTagIndex(topicRecords(topics)).canonical(input.tags), statement: input.statement.trim(),
      code: codeFile, language: input.language, createdAt: previous?.data.createdAt.toISOString() ?? now,
      updatedAt: now, draft: previous?.data.draft ?? false,
    };
    problemSchema.parse(data);
    const changes = [
      { path: join(solutionsDir, codeFile), content: `${input.code}\n` },
      { path: join(problemDir, `${id}.md`), content: matter.stringify(`${input.idea}\n`, data) },
    ];
    if (previous && previous.data.code !== codeFile) changes.push({ path: join(solutionsDir, previous.data.code), content: null });
    await writeTransaction(changes, io);
    await refresh();
    return { id, updatedAt: now };
  }

  async function saveTopic(raw) {
    const tag = String(raw.tag || "").trim();
    const content = String(raw.content || "").replace(/\r\n/g, "\n").trim();
    if (!tag || !content) throw new Error("请填写标签名称和知识点");
    const topics = await allTopics();
    const records = topicRecords(topics);
    const index = createTagIndex(records);
    const originalId = raw.originalId ? safeId(raw.originalId) : "";
    const previous = originalId ? topics.find((entry) => entry.id === originalId) : null;
    if (originalId && !previous) throw new Error("知识点不存在，请刷新列表");
    if (!originalId && index.find(tag)) throw new Error("这个标签已经有知识点，请从左侧列表打开");
    const catalog = await listTopicEntries();
    const knownTag = catalog.find((item) => index.key(item.name) === index.key(tag));
    const title = previous?.data.title ?? knownTag?.name ?? tag;
    const id = originalId || contentId(title);
    if (!originalId && topics.some((entry) => entry.id === id)) throw new Error("知识点标识冲突，请使用不同名称");
    const data = {
      title, summary: topicSummaryFrom(content, title), aliases: previous?.data.aliases ?? [],
      updatedAt: new Date().toISOString().slice(0, 10),
      order: previous?.data.order ?? Math.max(0, ...records.map((topic) => topic.order)) + 1,
      draft: previous?.data.draft ?? false,
    };
    topicSchema.parse(data);
    createTagIndex([...records.filter((topic) => topic.id !== id), { id, ...data }]);
    await writeTransaction([{ path: join(topicDir, `${id}.md`), content: matter.stringify(`${content}\n`, data) }], io);
    await refresh();
    return { id, title, updatedAt: data.updatedAt };
  }

  async function deleteTopic(id) {
    const topic = await findRecord(topicDir, topicSchema, id);
    const index = createTagIndex([{ id: topic.id, ...topic.data }]);
    const referenced = (await allProblems()).filter(({ data }) => data.tags.some((tag) => index.find(tag)));
    if (referenced.length) throw new Error(`有 ${referenced.length} 道题正在使用「${topic.data.title}」，不能删除`);
    await writeTransaction([{ path: join(topicDir, `${topic.id}.md`), content: null }], io);
    await refresh();
    return { id: topic.id, title: topic.data.title };
  }

  // Reads use the same queue so they cannot observe half of a two-file save.
  return Object.fromEntries(Object.entries({ listProblems, listTopicEntries, readProblem, readTopic, saveProblem, saveTopic, deleteTopic })
    .map(([name, operation]) => [name, (...args) => queue(async () => { await ready; return operation(...args); })]));
}
