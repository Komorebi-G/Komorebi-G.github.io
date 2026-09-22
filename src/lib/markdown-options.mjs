import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/** @type {import("@astrojs/markdown-remark").AstroMarkdownProcessorOptions} */
export const markdownOptions = {
  remarkPlugins: [remarkMath],
  rehypePlugins: [rehypeKatex],
  shikiConfig: { theme: "github-light" },
};
