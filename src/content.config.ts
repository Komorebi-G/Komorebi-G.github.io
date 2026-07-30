import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const problems = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/problems" }),
  schema: z.object({
    title: z.string().min(1),
    url: z.string().url(),
    platform: z.string().min(1),
    solvedAt: z.coerce.date(),
    tags: z.array(z.string().min(1)).min(1),
    statement: z.string().default(""),
    code: z.string().regex(/^[a-zA-Z0-9._-]+$/),
    language: z
      .enum(["cpp", "c", "python", "java", "javascript", "typescript", "rust", "text"])
      .default("cpp"),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

const topics = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/topics" }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    group: z.string().min(1),
    aliases: z.array(z.string().min(1)).default([]),
    updatedAt: z.coerce.date(),
    order: z.number().int().default(0),
    draft: z.boolean().default(false),
  }),
});

export const collections = { problems, topics };
