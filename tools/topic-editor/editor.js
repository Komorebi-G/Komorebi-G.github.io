const field = document.querySelector("#content");
const listNode = document.querySelector("#topic-list");
const listSearch = document.querySelector("#list-search");
const saveButton = document.querySelector("#save-topic");
const saveState = document.querySelector(".save-state");
const saveStateText = document.querySelector("#save-state");
const editorTitle = document.querySelector("#editor-title");
const sidebar = document.querySelector(".sidebar");
const viewTopic = document.querySelector("#view-topic");
let candidates = [];
let currentId = "";
let currentTag = "";
let currentTitle = "";
let activeListFilter = "all";
let dirty = false;
let saveTimer;

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const normalize = (value) => String(value || "")
  .toLocaleLowerCase()
  .replace(/[\s_-]+/g, "");

function toast(message, error = false) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.toggle("error", error);
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
}

function setDirty(value) {
  dirty = value;
  saveState.classList.toggle("dirty", value);
  saveState.classList.toggle("saved", !value);
  saveStateText.textContent = value ? "有未保存的修改" : currentId ? "知识点已保存" : "尚未保存";
}

function inlineMarkdown(value) {
  let result = escapeHtml(value);
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\$([^$]+)\$/g, '<span class="math">$1</span>');
  return result;
}

function renderTextBlocks(value) {
  const lines = value.split("\n");
  const html = [];
  let paragraph = [];
  let list = [];
  let listType = "";

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join("\n")).replaceAll("\n", "<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    html.push(`<${listType}>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${listType}>`);
    list = [];
    listType = "";
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    const inlineBlockMath = line.match(/^\$\$(.+)\$\$$/);
    const tableDivider = lines[index + 1]?.match(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/);

    if (line.trim() === "$$") {
      flushParagraph();
      flushList();
      const mathLines = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== "$$") {
        mathLines.push(lines[index]);
        index += 1;
      }
      html.push(`<span class="math block">${escapeHtml(mathLines.join(" ").trim())}</span>`);
    } else if (tableDivider && line.includes("|")) {
      flushParagraph();
      flushList();
      const splitRow = (row) => row.trim().replace(/^\||\|$/g, "")
        .split("|").map((cell) => cell.trim());
      const headers = splitRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      index -= 1;
      html.push(`<div class="preview-table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    } else if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(3, Math.max(2, heading[1].length));
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? "ul" : "ol";
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      list.push((unordered || ordered)[1]);
    } else if (inlineBlockMath) {
      flushParagraph();
      flushList();
      html.push(`<span class="math block">${escapeHtml(inlineBlockMath[1])}</span>`);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      paragraph.push(line);
    }
  }

  flushParagraph();
  flushList();
  return html.join("");
}

function markdownPreview(markdown) {
  if (!markdown.trim()) return "<p>Markdown 正文会显示在这里。</p>";
  return markdown.split(/```/).map((part, index) => {
    if (index % 2 === 0) return renderTextBlocks(part);
    const lines = part.replace(/^\n/, "").split("\n");
    if (/^[a-zA-Z0-9_+-]+$/.test(lines[0] || "")) lines.shift();
    return `<pre><code>${escapeHtml(lines.join("\n").trimEnd())}</code></pre>`;
  }).join("");
}

function updatePreview() {
  editorTitle.textContent = currentTitle || "选择一个标签";
  document.querySelector("#preview-title").textContent = currentTitle || "专题名称";
  document.querySelector("#preview-content").innerHTML = markdownPreview(field.value);
  viewTopic.hidden = !currentId;
  if (currentId) viewTopic.href = `/topics/${encodeURIComponent(currentId)}`;
}

function draftKey() {
  return `topic-editor:${currentId || `tag:${normalize(currentTag)}`}`;
}

function currentData() {
  return {
    originalId: currentId,
    tag: currentTag,
    content: field.value,
  };
}

function markChanged() {
  setDirty(true);
  updatePreview();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(draftKey(), JSON.stringify(currentData()));
    saveStateText.textContent = "草稿已自动保存";
  }, 500);
}

function blankContent() {
  return `## 核心概念

写下这个标签最重要、最通用的知识。

## 常见写法

\`\`\`cpp
// 在这里放常用写法或模板
\`\`\`

## 容易忘记的细节

- 
`;
}

function applyTopic(topic, candidateName, isExisting) {
  currentId = isExisting ? topic.id : "";
  currentTag = candidateName || topic.title;
  currentTitle = topic.title || candidateName;
  field.value = topic.content || blankContent();
  updatePreview();
  setDirty(false);
  renderTopicList();
  sidebar.classList.remove("open");
  field.focus();
}

async function loadTopic(id, candidateName = "") {
  if (dirty && !confirm("当前修改尚未保存，确定切换标签吗？")) return;
  const response = await fetch(`./api/topics/${encodeURIComponent(id)}`);
  const topic = await response.json();
  if (!response.ok) return toast(topic.error || "读取知识点失败", true);
  const savedDraft = localStorage.getItem(`topic-editor:${id}`);
  if (savedDraft) {
    try {
      if (confirm("找到这个标签的本地草稿，是否恢复？")) {
        topic.content = JSON.parse(savedDraft).content ?? topic.content;
      }
    } catch {}
  }
  applyTopic(topic, candidateName || topic.title, true);
}

function startCandidate(candidate) {
  if (dirty && !confirm("当前修改尚未保存，确定切换标签吗？")) return;
  const draftKeyForTag = `topic-editor:tag:${normalize(candidate.name)}`;
  let content = blankContent();
  const savedDraft = localStorage.getItem(draftKeyForTag);
  if (savedDraft) {
    try {
      if (confirm("找到这个标签的本地草稿，是否恢复？")) {
        content = JSON.parse(savedDraft).content ?? content;
      }
    } catch {}
  }
  applyTopic({ title: candidate.name, content }, candidate.name, false);
}

function openCandidate(candidate) {
  return candidate.topicId
    ? loadTopic(candidate.topicId, candidate.name)
    : startCandidate(candidate);
}

function renderTopicList() {
  const query = listSearch.value.trim().toLocaleLowerCase();
  const visible = candidates.filter((candidate) => {
    const matchesSearch = [candidate.name, ...(candidate.aliases || [])]
      .join(" ").toLocaleLowerCase().includes(query);
    const matchesFilter = activeListFilter === "all"
      || (activeListFilter === "written" ? candidate.topicId : !candidate.topicId);
    return matchesSearch && matchesFilter;
  });

  listNode.innerHTML = visible.length ? visible.map((candidate) => (
    `<button type="button" class="problem-item topic-item ${candidate.topicId ? "written" : ""} ${candidate.name === currentTag ? "active" : ""}" data-candidate="${escapeHtml(candidate.name)}">
      <strong>${escapeHtml(candidate.name)}</strong>
      <span>${candidate.count || 0} 道相关题目</span>
      <b class="topic-state">${candidate.topicId ? "已整理" : "待整理"}</b>
    </button>`
  )).join("") : `<div class="list-empty">没有匹配的标签。</div>`;

  listNode.querySelectorAll("[data-candidate]").forEach((button) => {
    button.addEventListener("click", () => {
      const candidate = candidates.find((item) => item.name === button.dataset.candidate);
      if (candidate) openCandidate(candidate);
    });
  });

  const written = candidates.filter((candidate) => candidate.topicId).length;
  document.querySelector("#topic-count").textContent = `${written}/${candidates.length} 已整理`;
}

async function refreshCandidates() {
  const response = await fetch("./api/topic-candidates");
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "读取标签失败");
  candidates = result;
  renderTopicList();
}

async function saveTopic() {
  if (!currentTag) return toast("请先从左侧选择一个标签", true);
  saveButton.disabled = true;
  saveStateText.textContent = "正在保存…";
  try {
    const response = await fetch("./api/topics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(currentData()),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "保存失败");
    localStorage.removeItem(draftKey());
    currentId = result.id;
    currentTitle = result.title || currentTitle;
    await refreshCandidates();
    updatePreview();
    setDirty(false);
    toast("知识点已保存");
  } catch (error) {
    toast(error.message, true);
    setDirty(true);
  } finally {
    saveButton.disabled = false;
  }
}

async function init() {
  try {
    await refreshCandidates();
    const params = new URLSearchParams(location.search);
    const requestedId = params.get("id");
    const requestedTag = params.get("tag");
    if (requestedId) {
      const candidate = candidates.find((item) => item.topicId === requestedId);
      await loadTopic(requestedId, candidate?.name);
    } else if (requestedTag) {
      const candidate = candidates.find((item) =>
        [item.name, ...(item.aliases || [])].some((name) => normalize(name) === normalize(requestedTag))
      );
      if (candidate) openCandidate(candidate);
      else toast("没有找到这个标签", true);
    } else {
      const initial = candidates.find((candidate) => candidate.topicId) ?? candidates[0];
      if (initial) openCandidate(initial);
    }
  } catch (error) {
    toast(error.message, true);
  }
}

field.addEventListener("input", markChanged);
field.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const start = field.selectionStart;
  const end = field.selectionEnd;
  field.setRangeText("  ", start, end, "end");
  markChanged();
});
listSearch.addEventListener("input", renderTopicList);
document.querySelectorAll("[data-list-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeListFilter = button.dataset.listFilter;
    document.querySelectorAll("[data-list-filter]").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    renderTopicList();
  });
});
saveButton.addEventListener("click", saveTopic);
document.querySelector("#clear-draft").addEventListener("click", () => {
  if (!currentTag || !confirm("确定放弃当前未保存的修改吗？")) return;
  localStorage.removeItem(draftKey());
  const candidate = candidates.find((item) => item.name === currentTag);
  if (candidate) openCandidate(candidate);
});
document.querySelector("#mobile-list").addEventListener("click", () => sidebar.classList.toggle("open"));
window.addEventListener("beforeunload", (event) => {
  if (!dirty) return;
  event.preventDefault();
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "s") {
    event.preventDefault();
    saveTopic();
  }
});

init();
