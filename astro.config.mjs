import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://komorebi-g.github.io",
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: {
    defaultStrategy: "hover",
  },
});
