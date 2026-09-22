import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { markdownOptions } from "../../src/lib/markdown-options.mjs";

let processor;
export async function renderMarkdown(markdown) {
  processor ??= createMarkdownProcessor(markdownOptions);
  return (await (await processor).render(markdown)).code;
}
