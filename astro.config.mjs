import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { markdownOptions } from "./src/lib/markdown-options.mjs";
import { validateContent } from "./scripts/lib/content-files.mjs";
import { fileURLToPath } from "node:url";

const editorPort = process.env.PROBLEM_EDITOR_PORT || "4322";
const editorTarget = `http://127.0.0.1:${editorPort}`;

export default defineConfig({
  site: "https://komorebi-g.github.io",
  markdown: markdownOptions,
  integrations: [{
    name: "content-integrity",
    hooks: { "astro:build:start": async () => { await validateContent(fileURLToPath(new URL(".", import.meta.url))); } },
  }],
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        "/topic-editor": {
          target: editorTarget,
          rewrite: (path) => path.replace(/^\/topic-editor\/api/, "/api"),
        },
        "/editor": {
          target: editorTarget,
          rewrite: (path) => path.replace(/^\/editor/, "") || "/",
        },
      },
    },
  },
  prefetch: {
    defaultStrategy: "hover",
  },
});
