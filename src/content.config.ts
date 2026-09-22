import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { problemSchema, topicSchema } from "./lib/content-schema.mjs";
import { contentId } from "./lib/tags.mjs";

const problems = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/problems", generateId: ({ entry }) => contentId(entry.slice(0, -3)) }),
  schema: problemSchema,
});

const tagKnowledge = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/problem-tags", generateId: ({ entry }) => contentId(entry.slice(0, -3)) }),
  schema: topicSchema,
});

export const collections = { problems, tagKnowledge };
