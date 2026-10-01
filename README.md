# LBH Personal Website

个人网站与算法课程演示归档，使用 Astro 构建。

## 页面与日常使用

- 概览：最近题目、知识点和统一搜索；本地模式提供记题、写知识点与草稿恢复入口。
- 题目：按关键词、标签和时间查找题解，阅读页提供思路、代码跳转和复制代码。
- 知识点：独立目录位于 `/knowledge`，可搜索正文、查看相关题目；本地模式可直接编辑或整理尚无笔记的标签。
- 项目：算法课程交互演示。
- 限时训练：次级工具入口，支持暂停、稍后继续、历史复盘与待补题管理。离开训练页会暂停计时；切到原题标签页仍继续计时。

公开网站用于检索和阅读，编辑入口仅在本地显示。编辑器草稿与训练记录存放在当前浏览器，不会随网站发布。

## 本地运行

```bash
npm install
npm run dev
```

一个命令会同时启动网站和本地题目编辑器：

- 网站：`http://localhost:4321`
- 题目编辑器：`http://localhost:4321/editor/`

编辑入口只在本地开发模式显示，不会发布到 GitHub Pages。

## WSL 自动控制 Windows Edge

安装依赖后，在 WSL 执行：

```bash
npm run edge
```

该命令自动启动或复用 Windows 原生 Edge 专用调试窗口，通过 CDP 连接
Playwright，并打开网站。若 4321 端口的网站尚未运行，会在后台启动 Astro，
同时启动缺失的题目与知识点编辑器，打印服务 PID。日志分别写入
`output/playwright/edge-site.log` 与 `output/playwright/edge-editor.log`。

```bash
npm run edge -- snapshot
# 使用 snapshot 返回的实际元素引用
npm run edge -- click <ref>
npm run edge -- fill <ref> "兜风"
npm run edge -- screenshot --filename output/playwright/edge.png
npm run edge -- console error
npm run edge -- detach
```

`detach` 断开控制并保留窗口和网站服务。再次执行 `npm run edge` 即可重新连接，
并回到首页。可以手动关闭专用 Edge 窗口；后台网站服务可使用启动时输出的 PID
执行 `kill <PID>` 停止。

前提是 WSL 已启用 Windows 互操作、Windows 已安装 Edge，且 WSL 能访问
Windows 的 `127.0.0.1:9333`。脚本不修改网络或防火墙配置，连接失败会明确报错。
浏览器使用 `%LOCALAPPDATA%\AgentBrowser\personal-site-edge` 独立配置目录，
不会使用日常 Edge 配置。调试端口固定为 9333，不应转发到公网。
截图和日志已被 Git 忽略。

## 课程演示

本地运行与构建前，脚本会从 `~/courses/Algorithm/` 同步五组实验到
`public/demos/`：

- exp2：最近点对
- exp3：图着色搜索
- exp4：鸡蛋掉落
- exp5：桥检测
- exp6：最大流

手动同步：

```bash
npm run sync:demos
```

同步后的演示文件提交进 Git，因此 GitHub Actions 不依赖本机课程目录。
其他机器没有课程目录时，本地开发和构建会使用仓库中的演示副本。
展示信息和同步来源统一维护在 `src/data/demos.mjs`。

## ICPC 题目归档

题目归档使用 Astro Content Collections：

- `src/content/problems/`：一题一个 Markdown 文件，保存题名、链接、标签、时间和思路
- `solutions/`：保存与题目同名的代码文件
题目标识由系统按完成日期自动维护，不在编辑页面展示。

启动开发服务后，从首页或固定导航中的“记一题”进入本地可视化编辑器：

```bash
npm run dev
```

粘贴链接后自动识别平台，日期默认为本地今天；平台、日期可展开调整。
题目大意是可选内容，默认折叠。编辑区默认单栏，点“预览”才展开正文预览。
编辑器支持标签补全、自动草稿以及 `Ctrl+S` 保存。切换题目时自动保留草稿，
返回时自动恢复；保存期间继续输入的内容会保留为未提交的草稿。
“题目大意”和“解题思路”都使用 Markdown 编写，并支持 LaTeX 数学公式；
编辑器预览和题目详情页共用 Markdown、代码高亮与 KaTeX 渲染配置。
保存新题后，开发服务器会自动重新收录题目。编辑器只在本地运行，线上网站保持只读。

提交 Markdown 与代码文件并推送到 `main` 后，GitHub Pages 会自动更新。

如需单独启动编辑器，仍可运行：

```bash
npm run problem:edit -- --no-open
```

省略 `--no-open` 会通过项目专用 Windows Edge 会话打开编辑器，不调用 Linux 浏览器。
独立编辑器仅提供录入功能；查看文章与返回归档需运行 `npm run dev`，通过 4321 端口进入。

## 标签知识点

标签知识点以 Markdown 存放在 `src/content/problem-tags/`。
从 `/knowledge` 的独立目录或题解中的知识点标签，可进入
`/problems/tags/<id>` 阅读正文；现有知识点链接继续可用。

启动本地开发服务后，可直接打开知识点编辑器：

```text
http://localhost:4321/topic-editor/
```

题目标签与知识点标签使用同一套数据：题目使用过的标签都会出现在知识点
编辑器中；新建知识点标签后，即使还没有题目引用，也会出现在知识点目录中。
已有知识点只需编辑 Markdown，标签名称和
内部元数据由系统自动维护。没有题目引用的知识点可以删除；被题目引用时
系统会阻止删除。保存时自动更新摘要和修改日期，保留原来的 `draft` 状态。
知识点文件名统一使用小写（包括中文名称中的拉丁字母），页面与编辑器共用相同 ID。

正文使用二级标题表示知识点、三级标题表示知识点内的小节。数学公式使用
`$...$` 或 `$$...$$`，代码直接使用带语言标识的 Markdown 代码块。

题目归档和标签板子可以合并生成一份适合打印的赛前速查册：

```bash
npm run build:handbook
```

成品会同时写入 `output/pdf/icpc-contest-handbook.pdf` 和网站可下载目录
`public/downloads/icpc-contest-handbook.pdf`。

## 构建与部署

```bash
npm test
npm run build
npm run preview
```

构建会检查内容字段、知识点别名冲突、代码文件缺失、重复引用、扩展名与语言不一致，
以及未被引用的代码文件。无需在录入界面手动维护这些关系。
回归测试使用临时目录，覆盖并发保存、失败回滚、草稿、标签和编辑器预览。
保存操作在本地服务内串行执行，普通 I/O 失败会回滚；这不等同于数据库的断电恢复。

推送到 `main` 后，GitHub Actions 自动部署到 GitHub Pages。
