import { spawn } from "node:child_process";
import { join } from "node:path";

const projectRoot = process.cwd();
const astroBin = join(projectRoot, "node_modules", ".bin", "astro");
const editorScript = join(projectRoot, "scripts", "problem-editor.mjs");
const children = [];
let stopping = false;

function start(command, args) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });
  children.push(child);
  return child;
}

start(process.execPath, [editorScript, "--no-open"]);
start(astroBin, ["dev"]);

console.log("\n本地开发服务正在启动：");
console.log("  网站与题目归档  http://localhost:4321");
console.log("  题目录入页面    http://localhost:4321/editor/");
console.log("按 Ctrl+C 同时停止两个服务。\n");

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

for (const child of children) {
  child.on("error", (error) => {
    console.error(`开发服务启动失败：${error.message}`);
    stop();
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`开发子进程意外退出（${signal ?? code}）。`);
      stop();
      process.exitCode = code ?? 1;
    }
    if (children.every((item) => item.exitCode !== null || item.signalCode !== null)) {
      process.exit();
    }
  });
}
