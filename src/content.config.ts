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
    code: z.string().regex(/^[a-zA-Z0-9._-]+$/),
    language: z
      .enum(["cpp", "c", "python", "java", "javascript", "typescript", "rust", "text"])
      .default("cpp"),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { problems };
