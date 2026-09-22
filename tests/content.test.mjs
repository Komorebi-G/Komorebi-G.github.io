import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import { createContentStore } from "../scripts/lib/content-store.mjs";
import { validateContent } from "../scripts/lib/content-files.mjs";
import { buildTagCatalog, contentId, createTagIndex, normalizeName } from "../src/lib/tags.mjs";
import { createEditorServer } from "../scripts/problem-editor.mjs";

const input = { title: "测试题", url: "https://example.com/problem", platform: "测试",
  solvedAt: "2026-09-22", tags: ["状压dp"], idea: "按集合转移。", code: "int main() {}", language: "cpp" };

async function fixture(t) {
  const root = await fs.mkdtemp(join(tmpdir(), "personal-site-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(join(root, "src"));
  await fs.writeFile(join(root, "src/content.config.ts"), "");
  const store = createContentStore(root);
  await store.listProblems();
  return { root, store };
}

async function setDraft(path) {
  const parsed = matter(await fs.readFile(path, "utf8"));
  parsed.data.draft = true;
  await fs.writeFile(path, matter.stringify(parsed.content, parsed.data));
}

test("concurrent creates keep all records and their corresponding code", async (t) => {
  const { root, store } = await fixture(t);
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) =>
    store.saveProblem({ ...input, title: `题 ${i}`, code: `// code ${i}` })));
  assert.equal(new Set(results.map((entry) => entry.id)).size, 8);
  for (let i = 0; i < results.length; i++) {
    const record = await store.readProblem(results[i].id);
    assert.equal(record.title, `题 ${i}`);
    assert.equal(record.code.trim(), `// code ${i}`);
  }
  assert.deepEqual(await validateContent(root), { problems: 8, topics: 0 });
});

test("failed second-file replacement rolls back code and metadata; queue remains usable", async (t) => {
  const { root, store } = await fixture(t);
  const { id } = await store.saveProblem(input);
  let fail = true;
  const failingStore = createContentStore(root, { ...fs, rename: async (from, to) => {
    if (fail && to.endsWith(`${id}.md`)) { fail = false; throw new Error("injected disk failure"); }
    return fs.rename(from, to);
  } });
  await assert.rejects(failingStore.saveProblem({ ...input, originalId: id, title: "changed", code: "// changed" }), /disk failure/);
  const restored = await store.readProblem(id);
  assert.equal(restored.title, input.title);
  assert.equal(restored.code.trim(), input.code);
  assert.equal((await fs.readdir(join(root, "solutions"))).length, 1);
  await failingStore.saveProblem({ ...input, originalId: id, title: "retry" });
  assert.equal((await store.readProblem(id)).title, "retry");
});

test("failed new record leaves no code or markdown orphan", async (t) => {
  const { root } = await fixture(t);
  const store = createContentStore(root, { ...fs, rename: async (from, to) => {
    if (to.endsWith(".md")) throw new Error("injected failure");
    return fs.rename(from, to);
  } });
  await assert.rejects(store.saveProblem(input), /injected/);
  assert.deepEqual(await fs.readdir(join(root, "solutions")), []);
  assert.deepEqual(await fs.readdir(join(root, "src/content/problems")), []);
});

test("failed removal during a language change restores both original files", async (t) => {
  const { root, store } = await fixture(t);
  const { id } = await store.saveProblem(input);
  const originalPath = join(root, `solutions/${id}.cpp`);
  const failingStore = createContentStore(root, { ...fs, unlink: async (path) => {
    if (path === originalPath) throw new Error("cannot remove old code");
    return fs.unlink(path);
  } });
  await assert.rejects(failingStore.saveProblem({ ...input, originalId: id, language: "python", code: "print(1)" }), /cannot remove/);
  const restored = await store.readProblem(id);
  assert.equal(restored.language, "cpp");
  assert.equal(restored.code.trim(), input.code);
  assert.deepEqual(await fs.readdir(join(root, "solutions")), [`${id}.cpp`]);
  await validateContent(root);
});

test("editing preserves draft state, updates summary, and replaces old language file", async (t) => {
  const { root, store } = await fixture(t);
  const problem = await store.saveProblem(input);
  const topic = await store.saveTopic({ tag: "状压 dp", content: "## 思路\n\n旧内容。" });
  await setDraft(join(root, `src/content/problems/${problem.id}.md`));
  await setDraft(join(root, `src/content/problem-tags/${topic.id}.md`));
  await store.saveProblem({ ...input, originalId: problem.id, language: "python", code: "print(1)" });
  await store.saveTopic({ tag: "状压 dp", originalId: topic.id, content: "## 思路\n\n新内容。" });
  assert.equal((await store.readProblem(problem.id)).draft, true);
  const savedTopic = await store.readTopic(topic.id);
  assert.equal(savedTopic.draft, true);
  assert.equal(savedTopic.summary, "新内容。");
  assert.deepEqual(await fs.readdir(join(root, "solutions")), [`${problem.id}.py`]);
  await validateContent(root);
});

test("mixed Chinese/Latin IDs work through editor API in either case", async (t) => {
  const { root, store } = await fixture(t);
  const topic = await store.saveTopic({ tag: "回文字符串Manacher", content: "## 半径\n\n线性算法。" });
  assert.equal(topic.id, "回文字符串manacher");
  assert.equal(contentId(topic.id), topic.id);
  assert.equal((await store.readTopic("回文字符串Manacher")).id, topic.id);
  const server = createEditorServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const prefix of ["/editor", "/topic-editor"]) {
    const response = await fetch(`${base}${prefix}/api/tag-knowledge/${encodeURIComponent(topic.id)}`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, topic.id);
    const module = await fetch(`${base}${prefix}/shared/editor-state.mjs`);
    assert.equal(module.status, 200);
    assert.match(module.headers.get("content-type"), /javascript/);
  }
  const css = await fetch(`${base}/topic-editor/shared/katex/katex.min.css`);
  assert.equal(css.status, 200);
  const font = await fetch(`${base}/topic-editor/shared/katex/fonts/KaTeX_Main-Regular.woff2`);
  assert.equal(font.status, 200);
});

test("alias counting deduplicates each problem, canonicalizes saves, and protects referenced notes", async (t) => {
  const topics = [{ id: "state", title: "状压 dp", aliases: ["状态压缩 DP", "bitmask dp"] }];
  const index = createTagIndex(topics);
  assert.deepEqual(index.canonical(["状压dp", "状态压缩 DP"]), ["状压 dp"]);
  assert.equal(buildTagCatalog([{ tags: ["状压dp", "状态压缩 DP"] }], topics)[0].count, 1);
  assert.equal(index.key("bitmask-dp"), index.key("状压dp"));
  assert.equal(normalizeName("SOS-DP"), normalizeName("sos_dp"));
  assert.throws(() => createTagIndex([...topics, { id: "other", title: "bitmask dp" }]), /同时属于/);
  const { store } = await fixture(t);
  const topic = await store.saveTopic({ tag: "状压 dp", content: "## 子集\n\n枚举子集。" });
  const problem = await store.saveProblem({ ...input, tags: ["状压dp", "状压 dp"] });
  assert.deepEqual((await store.readProblem(problem.id)).tags, ["状压 dp"]);
  assert.equal((await store.listTopicEntries())[0].count, 1);
  await assert.rejects(store.deleteTopic(topic.id), /不能删除/);
  const unused = await store.saveTopic({ tag: "凸包", content: "## Andrew\n\n扫描。" });
  await store.deleteTopic(unused.id);
});

test("content validation rejects missing, duplicate and wrong-language code references", async (t) => {
  const { root, store } = await fixture(t);
  const { id } = await store.saveProblem(input);
  const codePath = join(root, `solutions/${id}.cpp`);
  await fs.unlink(codePath);
  await assert.rejects(validateContent(root), /无法读取代码文件/);
  await fs.writeFile(codePath, input.code);
  const path = join(root, `src/content/problems/${id}.md`);
  const source = await fs.readFile(path, "utf8");
  await fs.writeFile(join(root, "src/content/problems/other.md"), source);
  await assert.rejects(validateContent(root), /同一代码文件/);
  await fs.unlink(join(root, "src/content/problems/other.md"));
  const parsed = matter(source);
  parsed.data.language = "python";
  await fs.writeFile(path, matter.stringify(parsed.content, parsed.data));
  await assert.rejects(validateContent(root), /扩展名/);
});

test("invalid calendar dates, unsafe URLs and paths fail before writing", async (t) => {
  const { root, store } = await fixture(t);
  await assert.rejects(store.saveProblem({ ...input, solvedAt: "2026-02-30" }));
  await assert.rejects(store.saveProblem({ ...input, url: "javascript:alert(1)" }));
  await assert.rejects(store.readTopic("../secret"));
  assert.deepEqual(await validateContent(root), { problems: 0, topics: 0 });
});
