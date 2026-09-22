import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createContentStore } from "./lib/content-store.mjs";
import { renderMarkdown } from "./lib/markdown.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const contentTypes = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
};
const sharedFiles = {
  "editor-state.mjs": "tools/shared/editor-state.mjs",
  "preview.mjs": "tools/shared/preview.mjs",
  "tags.mjs": "src/lib/tags.mjs",
  "languages.mjs": "src/lib/languages.mjs",
  "katex/katex.min.css": "node_modules/katex/dist/katex.min.css",
};

function sendJson(response, status, data) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

async function parseBody(request) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 4_000_000) throw new Error("请求内容过大");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export function createEditorServer(root = projectRoot) {
  const store = createContentStore(root);
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://localhost");
      if (["/editor", "/topic-editor"].includes(url.pathname)) {
        response.writeHead(302, { location: url.pathname + "/" + url.search });
        return response.end();
      }
      const path = url.pathname.replace(/^\/(?:topic-editor|editor)(?=\/)/, "") || "/";
      const method = request.method;
      if (method === "GET" && path === "/api/problems") return sendJson(response, 200, await store.listProblems());
      if (method === "GET" && ["/api/tags", "/api/tag-knowledge"].includes(path)) {
        return sendJson(response, 200, await store.listTopicEntries());
      }
      if (method === "POST" && path === "/api/preview") {
        const { markdown = "" } = await parseBody(request);
        return sendJson(response, 200, { html: await renderMarkdown(String(markdown)) });
      }
      if (method === "POST" && path === "/api/problems") return sendJson(response, 200, await store.saveProblem(await parseBody(request)));
      if (method === "POST" && path === "/api/tag-knowledge") return sendJson(response, 200, await store.saveTopic(await parseBody(request)));
      const record = path.match(/^\/api\/(problems|tag-knowledge)\/([^/]+)$/);
      if (record) {
        const id = decodeURIComponent(record[2]);
        if (method === "GET") return sendJson(response, 200, await store[record[1] === "problems" ? "readProblem" : "readTopic"](id));
        if (method === "DELETE" && record[1] === "tag-knowledge") return sendJson(response, 200, await store.deleteTopic(id));
      }
      let filePath;
      if (path.startsWith("/shared/")) {
        const name = path.slice("/shared/".length);
        const font = /^katex\/fonts\/[a-zA-Z0-9_-]+\.(woff2?|ttf)$/.test(name);
        filePath = sharedFiles[name] || (font ? "node_modules/katex/dist/" + name.slice(6) : "");
      } else {
        const name = path.slice(1) || "index.html";
        if (["index.html", "editor.css", "editor.js"].includes(name)) {
          filePath = "tools/" + (url.pathname.startsWith("/topic-editor/") ? "topic-editor" : "problem-editor") + "/" + name;
        }
      }
      if (method !== "GET" || !filePath) {
        response.writeHead(404);
        return response.end("Not found");
      }
      const file = await readFile(join(projectRoot, filePath));
      response.writeHead(200, { "content-type": contentTypes[extname(filePath)] });
      response.end(file);
    } catch (error) {
      const field = error.issues?.[0]?.path?.[0];
      const messages = {
        title: "请填写题目名称", url: "请粘贴完整的 HTTP 或 HTTPS 原题链接", platform: "请填写题目平台",
        solvedAt: "请选择有效的完成日期", tags: "请至少添加一个标签", idea: "请写下解题思路",
        code: "请粘贴代码", language: "请选择支持的代码语言",
      };
      sendJson(response, error.code === "ENOENT" ? 404 : 400, { error: messages[field] || error.message || "未知错误", field });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PROBLEM_EDITOR_PORT || 4322);
  const server = createEditorServer();
  server.listen(port, "127.0.0.1", () => {
    console.log("题目编辑器已启动：http://127.0.0.1:" + port + "/editor/");
    console.log("按 Ctrl+C 停止。");
    if (!process.argv.includes("--no-open")) {
      // Use the project's dedicated Windows Edge profile for standalone editing too.
      const child = spawn(process.execPath, [join(projectRoot, "scripts/edge.mjs"), "start", "http://127.0.0.1:" + port + "/editor/"], { stdio: "inherit" });
      child.on("error", (error) => console.error("自动打开失败：", error.message));
      child.on("exit", (code) => { if (code) console.error("浏览器未能打开，编辑器服务仍可通过上述地址访问。"); });
    }
  });
}
