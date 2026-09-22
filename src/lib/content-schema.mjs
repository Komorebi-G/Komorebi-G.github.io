import { z } from "astro/zod";
import { languages } from "./languages.mjs";
import { normalizeName } from "./tags.mjs";

const nonempty = z.string().trim().min(1);
const tagName = nonempty.refine((value) => Boolean(normalizeName(value)), "标签名称不能为空");
const languageNames = /** @type {[keyof typeof languages, ...(keyof typeof languages)[]]} */ (Object.keys(languages));
const language = z.enum(languageNames).default("cpp");
const date = z.union([z.date(), nonempty]).pipe(z.coerce.date());
const solvedDate = z.preprocess(
  (value) => value instanceof Date ? value.toISOString().slice(0, 10) : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "请选择有效的完成日期").transform((value) => new Date(value)),
);

export const problemSchema = z.object({
  title: nonempty,
  url: z.string().url().refine((value) => /^https?:\/\//i.test(value), "原题链接必须使用 HTTP 或 HTTPS"),
  platform: nonempty,
  solvedAt: solvedDate,
  tags: z.array(tagName).min(1),
  statement: z.string().default(""),
  code: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
  language,
  createdAt: date,
  updatedAt: date,
  draft: z.boolean().default(false),
});

export const problemInputSchema = problemSchema.omit({
  code: true, createdAt: true, updatedAt: true, draft: true,
}).extend({ idea: nonempty, code: z.string().refine((value) => Boolean(value.trim()), "请粘贴代码")
  .transform((value) => value.replace(/\r\n/g, "\n").trimEnd()) });

export const topicSchema = z.object({
  title: tagName,
  summary: nonempty,
  aliases: z.array(tagName).default([]),
  updatedAt: date,
  order: z.number().int().default(0),
  draft: z.boolean().default(false),
});
