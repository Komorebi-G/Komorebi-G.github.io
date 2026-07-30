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
- `src/data/tags.json`：编辑器使用的统一标签词表

题目标识由编辑器按 `YYYYMMDD-编号` 自动生成，例如 `20260729-01`，无需手动填写。

启动开发服务后，从网站导航中的“录入题目”进入本地可视化编辑器：

```bash
npm run dev
```

编辑器支持链接识别、标签补全、实时预览、自动草稿以及 `Ctrl+S` 保存。
保存新题后，开发服务器会自动重新收录题目。编辑器只在本地运行，线上网站保持只读。

提交 Markdown 与代码文件并推送到 `main` 后，GitHub Pages 会自动更新。

如需单独启动编辑器，仍可运行：

```bash
npm run problem:edit -- --no-open
```

## 算法笔记

算法笔记以 Markdown 作为唯一内容源，存放在 `src/content/topics/`。每篇笔记会生成：

- `/topics/<id>/`：适合网页搜索和移动端阅读的专题页
- `public/topics/<id>.pdf`：适合打印和离线复习的 PDF 版本

新建笔记时使用以下 frontmatter：

```yaml
---
title: 状压 DP
summary: 用一个整数表示集合状态，在可控的指数复杂度内完成动态规划。
group: 动态规划
aliases:
  - 状压dp
  - bitmask dp
updatedAt: 2026-07-30
order: 1
draft: false
---
```

正文使用二级标题表示知识点、三级标题表示知识点内的小节。数学公式使用
`$...$` 或 `$$...$$`，代码直接使用带语言标识的 Markdown 代码块。

本地开发和完整构建会自动执行 Markdown → LaTeX → PDF。也可以只生成全部
专题，或指定一个专题：

```bash
npm run topic:pdf
npm run topic:pdf -- state-compression-dp
```

PDF 生成依赖 Pandoc、XeLaTeX 和 `ctex`。统一版式位于
`templates/topic.tex`；转换脚本位于 `scripts/build-topic-pdfs.mjs`。
生成后的 PDF 需要与 Markdown 一起提交，GitHub Pages 部署时直接使用成品。

## 构建与部署

```bash
npm run build
npm run preview
```

推送到 `main` 后，GitHub Actions 自动部署到 GitHub Pages。
