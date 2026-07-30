const form = document.querySelector("#problem-form");
const fields = Object.fromEntries(
  ["title", "id", "group", "order", "summary", "aliases", "content"]
    .map((id) => [id, document.querySelector(`#${id}`)]),
);
const listNode = document.querySelector("#topic-list");
const listSearch = document.querySelector("#list-search");
const saveButton = document.querySelector("#save-topic");
const saveState = document.querySelector(".save-state");
const saveStateText = document.querySelector("#save-state");
const editorTitle = document.querySelector("#editor-title");
const sidebar = document.querySelector(".sidebar");
const viewTopic = document.querySelector("#view-topic");
let candidates = [];
let originalId = "";
let activeCandidate = "";
let activeListFilter = "all";
let dirty = false;
let saveTimer;

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function toast(message, error = false) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.toggle("error", error);
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
}

function generatedId(value) {
  const id = String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return /^[\x00-\x7F]+$/.test(id) ? id.toLocaleLowerCase() : id;
}

function updateGeneratedId() {
  const id = originalId || generatedId(fields.title.value);
  fields.id.value = id;
  document.querySelector("#id-display").textContent = id || "根据名称自动生成";
}

function setDirty(value) {
  dirty = value;
  saveState.classList.toggle("dirty", value);
  saveState.classList.toggle("saved", !value);
  saveStateText.textContent = value ? "有未保存的修改" : originalId ? "专题已保存" : "尚未保存";
}

function parseAliases() {
  return [...new Set(fields.aliases.value
    .split(/[,，\n]/)
    .map((value) => value.trim())
    .filter(Boolean))];
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
    const blockMath = line.match(/^\$\$(.+)\$\$$/);
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
    } else if (blockMath) {
      flushParagraph();
      flushList();
      html.push(`<span class="math block">${escapeHtml(blockMath[1])}</span>`);
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
  const parts = markdown.split(/```/);
  return parts.map((part, index) => {
    if (index % 2 === 0) return renderTextBlocks(part);
    const lines = part.replace(/^\n/, "").split("\n");
    if (/^[a-zA-Z0-9_+-]+$/.test(lines[0] || "")) lines.shift();
    return `<pre><code>${escapeHtml(lines.join("\n").trimEnd())}</code></pre>`;
  }).join("");
}

function updatePreview() {
  updateGeneratedId();
  document.querySelector("#preview-title").textContent = fields.title.value || "专题名称";
  document.querySelector("#preview-summary").textContent = fields.summary.value || "一句话简介会显示在这里。";
  document.querySelector("#preview-group").textContent = fields.group.value || "未分类";
  document.querySelector("#preview-state").textContent = originalId ? "已整理" : "新专题";
  document.querySelector("#preview-aliases").innerHTML = parseAliases()
    .map((alias) => `<span>${escapeHtml(alias)}</span>`).join("");
  document.querySelector("#preview-content").innerHTML = markdownPreview(fields.content.value);
  editorTitle.textContent = originalId ? `编辑「${fields.title.value || "专题"}」` : fields.title.value ? `整理「${fields.title.value}」` : "新建知识专题";
  viewTopic.hidden = !originalId;
  if (originalId) viewTopic.href = `/topics/${encodeURIComponent(originalId)}`;
}

function draftKey() {
  return `topic-editor:${originalId || fields.id.value || "new"}`;
}

function currentData() {
  return {
    originalId,
    id: fields.id.value,
    title: fields.title.value.trim(),
    summary: fields.summary.value.trim(),
    group: fields.group.value.trim(),
    order: Number(fields.order.value || 0),
    aliases: parseAliases(),
    content: fields.content.value,
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

function fillForm(topic, isExisting = false) {
  originalId = isExisting ? topic.id : "";
  fields.title.value = topic.title || "";
  fields.group.value = topic.group || "";
  fields.order.value = topic.order ?? nextOrder();
  fields.summary.value = topic.summary || "";
  fields.aliases.value = (topic.aliases || []).join(", ");
  fields.content.value = topic.content || blankContent();
  activeCandidate = topic.candidateName || topic.title || "";
  updatePreview();
  setDirty(false);
  renderTopicList();
  sidebar.classList.remove("open");
}

function nextOrder() {
  const orders = candidates
    .filter((candidate) => candidate.topicId)
    .map((candidate) => Number(candidate.order || 0));
  return Math.max(0, ...orders) + 1;
}

function newTopic(candidate = {}) {
  const saved = localStorage.getItem("topic-editor:new");
  let topic = {
    title: candidate.name || "",
    group: candidate.group || "",
    aliases: candidate.aliases || [],
    summary: "",
    content: blankContent(),
    order: nextOrder(),
    candidateName: candidate.name || "",
  };
  if (!candidate.name && saved) {
    try { topic = { ...topic, ...JSON.parse(saved) }; } catch {}
  }
  fillForm(topic, false);
  (fields.title.value ? fields.summary : fields.title).focus();
}

async function loadTopic(id, candidateName = "") {
  if (dirty && !confirm("当前修改尚未保存，确定切换标签吗？")) return;
  const response = await fetch(`./api/topics/${encodeURIComponent(id)}`);
  const topic = await response.json();
  if (!response.ok) return toast(topic.error || "读取专题失败", true);
  topic.candidateName = candidateName || topic.title;
  const draft = localStorage.getItem(`topic-editor:${id}`);
  if (draft) {
    try {
      if (confirm("找到这个专题的本地草稿，是否恢复？")) Object.assign(topic, JSON.parse(draft));
    } catch {}
  }
  fillForm(topic, true);
}

function openCandidate(candidate) {
  if (candidate.topicId) return loadTopic(candidate.topicId, candidate.name);
  if (dirty && !confirm("当前修改尚未保存，确定切换标签吗？")) return;
  newTopic(candidate);
}

function renderTopicList() {
  const query = listSearch.value.trim().toLocaleLowerCase();
  const visible = candidates.filter((candidate) => {
    const matchesSearch = [candidate.name, candidate.group, ...(candidate.aliases || [])]
      .join(" ").toLocaleLowerCase().includes(query);
    const matchesFilter = activeListFilter === "all"
      || (activeListFilter === "written" ? candidate.topicId : !candidate.topicId);
    return matchesSearch && matchesFilter;
  });

  listNode.innerHTML = visible.length ? visible.map((candidate) => (
    `<button type="button" class="problem-item topic-item ${candidate.topicId ? "written" : ""} ${candidate.name === activeCandidate ? "active" : ""}" data-candidate="${escapeHtml(candidate.name)}">
      <strong>${escapeHtml(candidate.name)}</strong>
      <span>${escapeHtml(candidate.group)} · <em>${candidate.count || 0} 道题</em></span>
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
  const groups = [...new Set(candidates.map((candidate) => candidate.group).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
  document.querySelector("#group-options").innerHTML = groups
    .map((group) => `<option value="${escapeHtml(group)}"></option>`).join("");
  renderTopicList();
}

async function saveTopic() {
  const payload = currentData();
  saveButton.disabled = true;
  saveStateText.textContent = "正在保存 Markdown 并生成 PDF…";
  try {
    const response = await fetch("./api/topics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "保存失败");
    localStorage.removeItem(draftKey());
    originalId = result.id;
    fields.id.value = result.id;
    activeCandidate = fields.title.value;
    await refreshCandidates();
    updatePreview();
    setDirty(false);
    toast("Markdown 与 PDF 已同步保存");
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
      await loadTopic(requestedId);
    } else if (requestedTag) {
      const normalized = requestedTag.toLocaleLowerCase().replace(/[\s_-]+/g, "");
      const candidate = candidates.find((item) =>
        [item.name, ...(item.aliases || [])]
          .some((name) => name.toLocaleLowerCase().replace(/[\s_-]+/g, "") === normalized)
      );
      candidate ? openCandidate(candidate) : newTopic({ name: requestedTag });
    } else {
      const firstWritten = candidates.find((candidate) => candidate.topicId);
      firstWritten ? await loadTopic(firstWritten.topicId, firstWritten.name) : newTopic();
    }
  } catch (error) {
    toast(error.message, true);
    newTopic();
  }
}

for (const field of Object.values(fields)) {
  field.addEventListener("input", markChanged);
}
fields.content.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const start = fields.content.selectionStart;
  const end = fields.content.selectionEnd;
  fields.content.setRangeText("  ", start, end, "end");
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
document.querySelector("#new-topic").addEventListener("click", () => {
  if (!dirty || confirm("当前修改尚未保存，确定新建专题吗？")) newTopic();
});
document.querySelector("#clear-draft").addEventListener("click", () => {
  if (!confirm("确定放弃当前未保存的修改吗？")) return;
  localStorage.removeItem(draftKey());
  if (originalId) loadTopic(originalId, activeCandidate);
  else {
    const candidate = candidates.find((item) => item.name === activeCandidate);
    newTopic(candidate || {});
  }
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
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "n") {
    event.preventDefault();
    if (!dirty || confirm("当前修改尚未保存，确定新建专题吗？")) newTopic();
  }
});

init();
