# LBH Personal Website

个人网站与算法课程演示归档，使用 Astro 构建。

## 本地运行

```bash
npm install
npm run dev
```

访问 `http://localhost:4321`。

## 课程演示

本地运行与构建前，脚本会从 `~/lesson/Algorithm/` 同步五组实验到
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

## 构建与部署

```bash
npm run build
npm run preview
```

推送到 `main` 后，GitHub Actions 自动部署到 GitHub Pages。
