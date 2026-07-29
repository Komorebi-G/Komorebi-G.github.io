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

## 构建与部署

```bash
npm run build
npm run preview
```

推送到 `main` 后，GitHub Actions 自动部署到 GitHub Pages。
