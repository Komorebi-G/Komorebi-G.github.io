import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const editorPort = process.env.PROBLEM_EDITOR_PORT || "4322";
const editorTarget = `http://127.0.0.1:${editorPort}`;

export default defineConfig({
  site: "https://komorebi-g.github.io",
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      theme: "github-light",
    },
  },
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
