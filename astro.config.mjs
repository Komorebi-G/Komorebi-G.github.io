import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://komorebi-g.github.io",
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
