import { requestJson } from "./editor-state.mjs";

export function bindPreviewToggle(button, app, key) {
  let open = localStorage.getItem(key) === "true";
  const update = () => {
    app.classList.toggle("preview-open", open);
    button.textContent = open ? "收起预览" : "预览";
    button.setAttribute("aria-expanded", String(open));
  };
  update();
  button.addEventListener("click", () => {
    open = !open;
    localStorage.setItem(key, String(open));
    update();
    if (open && window.innerWidth <= 1100) app.querySelector(".preview-pane").scrollIntoView({ behavior: "smooth" });
  });
}

// Use the site's real Markdown/KaTeX renderer; ignore responses for older input.
export function createPreview(node) {
  let previous;
  let version = 0;
  let timer;
  return (markdown) => {
    if (markdown === previous) return;
    previous = markdown;
    const current = ++version;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const result = await requestJson("./api/preview", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ markdown }),
        });
        if (current === version) node.innerHTML = result.html || "<p>Markdown 内容会显示在这里。</p>";
      } catch {
        if (current === version) {
          node.textContent = markdown || "预览暂时不可用，内容仍可编辑和保存。";
          previous = undefined;
        }
      }
    }, 200);
  };
}
