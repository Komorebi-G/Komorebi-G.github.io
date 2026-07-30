import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export default defineConfig({
  site: "https://komorebi-g.github.io",
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        "/editor": {
          target: "http://127.0.0.1:4322",
          rewrite: (path) => path.replace(/^\/editor/, "") || "/",
        },
      },
    },
  },
  prefetch: {
    defaultStrategy: "hover",
  },
});
