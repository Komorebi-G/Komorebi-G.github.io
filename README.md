# LBH Personal Website

个人网站与算法课程演示归档，使用 Astro 构建。

## 本地运行

```bash
npm install
npm run dev
```

一个命令会同时启动网站和本地题目编辑器：

- 网站：`http://localhost:4321`
- 题目编辑器：`http://localhost:4321/editor/`

编辑入口只在本地开发模式显示，不会发布到 GitHub Pages。

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

## ICPC 题目归档

题目归档使用 Astro Content Collections：

- `src/content/problems/`：一题一个 Markdown 文件，保存题名、链接、标签、时间和思路
- `solutions/`：保存与题目同名的代码文件
题目标识由系统按完成日期自动维护，不在编辑页面展示。

启动开发服务后，从网站导航中的“录入题目”进入本地可视化编辑器：

```bash
npm run dev
```

编辑器支持链接识别、标签补全、实时预览、自动草稿以及 `Ctrl+S` 保存。
“题目大意”和“解题思路”都使用 Markdown 编写，并支持 LaTeX 数学公式；
题目详情页会使用 KaTeX 渲染公式，但不会额外生成 PDF。
保存新题后，开发服务器会自动重新收录题目。编辑器只在本地运行，线上网站保持只读。

提交 Markdown 与代码文件并推送到 `main` 后，GitHub Pages 会自动更新。

如需单独启动编辑器，仍可运行：

```bash
npm run problem:edit -- --no-open
```

## 标签知识点

标签知识点是题目归档的一部分，以 Markdown 存放在
`src/content/problem-tags/`。在 `/problems` 的标签旁点击箭头，可直接进入
`/problems/tags/<id>` 阅读对应知识点。

启动本地开发服务后，可直接打开知识点编辑器：

```text
http://localhost:4321/topic-editor/
```

题目标签与知识点标签使用同一套数据：题目使用过的标签都会出现在知识点
编辑器中；新建知识点标签后，即使还没有题目引用，也会在题目归档中显示为
`标签名 0`，并提供知识点跳转。已有知识点只需编辑 Markdown，标签名称和
内部元数据由系统自动维护。没有题目引用的知识点可以删除；被题目引用时
系统会阻止删除。保存时只更新对应的 Markdown 内容。

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
npm run build
npm run preview
```

推送到 `main` 后，GitHub Actions 自动部署到 GitHub Pages。
