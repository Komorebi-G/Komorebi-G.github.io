每次完善并验证个人网站后，执行 `git add . && git commit -m "<简述修改>" && git push origin main`，以自动部署最新版本。

需要可见浏览器实测时，在 WSL 执行 `npm run edge`，自动启动或复用 Windows 原生 Edge 专用调试窗口、启动缺失的网站服务并连接 Playwright。无需用户手动启动，也不要启动 WSL GUI 浏览器。

随后使用 `npm run edge -- snapshot` 获取元素引用，再执行 `npm run edge -- click <ref>`、`npm run edge -- fill <ref> "文本"` 等操作。截图保存到 `output/playwright/`，例如 `npm run edge -- screenshot --filename output/playwright/edge.png`。使用 `npm run edge -- console error` 检查报错。结束控制可执行 `npm run edge -- detach`，保留窗口供用户查看。

专用会话为 `personal-site-edge`，调试端口为 localhost:9333，Windows 配置目录为 `%LOCALAPPDATA%\AgentBrowser\personal-site-edge`。仅连接该专用实例；不接管日常 Edge 配置，不关闭其他浏览器，不自动修改防火墙。若连接失败，报告原因，不得回退到 WSL/Linux 浏览器。跨项目浏览器操作遵循全局 `wsl-windows-edge` 技能。
