import * as fs from "node:fs/promises";
import { join, extname } from "node:path";
import matter from "gray-matter";
import { problemSchema, topicSchema } from "../../src/lib/content-schema.mjs";
import { contentId, createTagIndex } from "../../src/lib/tags.mjs";
import { languages } from "../../src/lib/languages.mjs";

export async function readCollection(directory, schema, io = fs) {
  const files = await io.readdir(directory);
  return Promise.all(files.filter((file) => file.endsWith(".md")).sort().map(async (file) => {
    const id = file.slice(0, -3);
    if (contentId(id) !== id) throw new Error(`请将 ${file} 重命名为 ${contentId(id)}.md`);
    const source = matter(await io.readFile(join(directory, file), "utf8"));
    const parsed = schema.safeParse(source.data);
    if (!parsed.success) throw new Error(`${file}: ${parsed.error.message}`);
    return { id, data: parsed.data, body: source.content.trim() };
  }));
}

export async function validateContent(root) {
  const [problems, topics] = await Promise.all([
    readCollection(join(root, "src/content/problems"), problemSchema),
    readCollection(join(root, "src/content/problem-tags"), topicSchema),
  ]);
  createTagIndex(topics.map(({ id, data }) => ({ id, ...data })));
  const referenced = new Map();
  for (const { id, data } of problems) {
    if (referenced.has(data.code)) throw new Error(`${id} 与 ${referenced.get(data.code)} 引用了同一代码文件 ${data.code}`);
    referenced.set(data.code, id);
    if (extname(data.code) !== `.${languages[data.language].extension}`) {
      throw new Error(`${id}: 代码扩展名与语言 ${data.language} 不一致`);
    }
    const path = join(root, "solutions", data.code);
    const code = await fs.readFile(path, "utf8").catch((error) => {
      throw new Error(`${id}: 无法读取代码文件 ${data.code}`, { cause: error });
    });
    if (!code.trim()) throw new Error(`${id}: 代码文件为空`);
  }
  const orphaned = (await fs.readdir(join(root, "solutions")))
    .filter((name) => !name.startsWith(".") && !referenced.has(name));
  if (orphaned.length) throw new Error(`代码文件没有题目引用：${orphaned.join("、")}`);
  return { problems: problems.length, topics: topics.length };
}
