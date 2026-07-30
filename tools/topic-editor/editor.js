const field = document.querySelector("#content");
const listNode = document.querySelector("#topic-list");
const listSearch = document.querySelector("#list-search");
const saveButton = document.querySelector("#save-topic");
const saveState = document.querySelector(".save-state");
const saveStateText = document.querySelector("#save-state");
const editorTitle = document.querySelector("#editor-title");
const sidebar = document.querySelector(".sidebar");
const viewTopic = document.querySelector("#view-topic");
const deleteButton = document.querySelector("#delete-topic");
const topicNameGroup = document.querySelector("#new-topic-name");
const topicNameField = document.querySelector("#topic-name");
let topics = [];
let currentId = "";
let currentTag = "";
let currentTitle = "";
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
  const title = currentId ? currentTitle : topicNameField.value.trim();
  editorTitle.textContent = currentId ? currentTitle : "新建标签知识点";
  document.querySelector("#preview-title").textContent = title || "新标签";
  document.querySelector("#preview-content").innerHTML = markdownPreview(field.value);
  viewTopic.hidden = !currentId;
  deleteButton.hidden = !currentId;
  if (currentId) viewTopic.href = `/topics/${encodeURIComponent(currentId)}`;
}

function draftKey() {
  return `topic-editor:${currentId || "new"}`;
}

function currentData() {
  return {
    originalId: currentId,
    tag: currentId ? currentTag : topicNameField.value.trim(),
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
  topicNameGroup.hidden = isExisting;
  topicNameField.value = isExisting ? "" : currentTitle;
  field.value = topic.content || blankContent();
  updatePreview();
  setDirty(false);
  renderTopicList();
  sidebar.classList.remove("open");
  (isExisting ? field : topicNameField).focus();
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

function newTopic(restoreDraft = true) {
  if (dirty && !confirm("当前修改尚未保存，确定切换标签吗？")) return;
  currentId = "";
  currentTag = "";
  currentTitle = "";
  topicNameGroup.hidden = false;
  topicNameField.value = "";
  let content = blankContent();
  const savedDraft = restoreDraft ? localStorage.getItem("topic-editor:new") : null;
  if (savedDraft) {
    try {
      if (confirm("找到尚未保存的新知识点草稿，是否恢复？")) {
        const draft = JSON.parse(savedDraft);
        topicNameField.value = draft.tag ?? "";
        content = draft.content ?? content;
      }
    } catch {}
  }
  field.value = content;
  updatePreview();
  setDirty(false);
  renderTopicList();
  sidebar.classList.remove("open");
  topicNameField.focus();
}

function renderTopicList() {
  const query = listSearch.value.trim().toLocaleLowerCase();
  const visible = topics.filter((topic) =>
    [topic.name, ...(topic.aliases || [])]
      .join(" ").toLocaleLowerCase().includes(query)
  );

  listNode.innerHTML = visible.length ? visible.map((topic) => (
    `<button type="button" class="problem-item topic-item ${topic.topicId === currentId ? "active" : ""}" data-topic-id="${escapeHtml(topic.topicId)}">
      <strong>${escapeHtml(topic.name)}</strong>
      <span>${topic.count || 0} 道关联题目</span>
    </button>`
  )).join("") : `<div class="list-empty">${query ? "没有匹配的知识点。" : "还没有知识点，点击右上角 ＋ 新建。"}</div>`;

  listNode.querySelectorAll("[data-topic-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const topic = topics.find((item) => item.topicId === button.dataset.topicId);
      if (topic) loadTopic(topic.topicId, topic.name);
    });
  });

  document.querySelector("#topic-count").textContent = `${topics.length} 个知识点`;
}

async function refreshTopics() {
  const [topicsResponse, tagsResponse] = await Promise.all([
    fetch("./api/topics"),
    fetch("./api/tags"),
  ]);
  const result = await topicsResponse.json();
  if (!topicsResponse.ok) throw new Error(result.error || "读取知识点失败");
  topics = result;
  if (tagsResponse.ok) {
    const tags = await tagsResponse.json();
    document.querySelector("#known-tags").innerHTML = tags
      .filter((tag) => !topics.some((topic) =>
        [topic.name, ...(topic.aliases || [])]
          .some((name) => normalize(name) === normalize(tag.name))
      ))
      .map((tag) => `<option value="${escapeHtml(tag.name)}"></option>`)
      .join("");
  }
  renderTopicList();
}

async function saveTopic() {
  const payload = currentData();
  if (!payload.tag) return toast("请填写新标签名称", true);
  saveButton.disabled = true;
  saveStateText.textContent = "正在保存…";
  try {
    const response = await fetch("./api/topics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "保存失败");
    localStorage.removeItem(draftKey());
    currentId = result.id;
    currentTag = result.title;
    currentTitle = result.title;
    topicNameGroup.hidden = true;
    await refreshTopics();
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

async function deleteTopic() {
  if (!currentId) return;
  if (!confirm(`确定删除「${currentTitle}」的知识点吗？此操作会同时删除 Markdown 和 PDF。`)) return;
  deleteButton.disabled = true;
  try {
    const response = await fetch(`./api/topics/${encodeURIComponent(currentId)}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "删除失败");
    localStorage.removeItem(draftKey());
    toast(`已删除「${result.title}」`);
    currentId = "";
    setDirty(false);
    await refreshTopics();
    if (topics.length) await loadTopic(topics[0].topicId, topics[0].name);
    else newTopic(false);
  } catch (error) {
    toast(error.message, true);
  } finally {
    deleteButton.disabled = false;
  }
}

async function init() {
  try {
    await refreshTopics();
    const params = new URLSearchParams(location.search);
    const requestedId = params.get("id");
    const requestedTag = params.get("tag");
    if (requestedId) {
      const topic = topics.find((item) => item.topicId === requestedId);
      await loadTopic(requestedId, topic?.name);
    } else if (requestedTag) {
      const topic = topics.find((item) =>
        [item.name, ...(item.aliases || [])].some((name) => normalize(name) === normalize(requestedTag))
      );
      if (topic) await loadTopic(topic.topicId, topic.name);
      else {
        newTopic(false);
        topicNameField.value = requestedTag;
        updatePreview();
      }
    } else {
      if (topics.length) await loadTopic(topics[0].topicId, topics[0].name);
      else newTopic();
    }
  } catch (error) {
    toast(error.message, true);
  }
}

field.addEventListener("input", markChanged);
topicNameField.addEventListener("input", markChanged);
field.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const start = field.selectionStart;
  const end = field.selectionEnd;
  field.setRangeText("  ", start, end, "end");
  markChanged();
});
listSearch.addEventListener("input", renderTopicList);
saveButton.addEventListener("click", saveTopic);
deleteButton.addEventListener("click", deleteTopic);
document.querySelector("#new-topic").addEventListener("click", () => newTopic());
document.querySelector("#clear-draft").addEventListener("click", () => {
  if (!confirm("确定放弃当前未保存的修改吗？")) return;
  localStorage.removeItem(draftKey());
  setDirty(false);
  if (currentId) loadTopic(currentId, currentTag);
  else newTopic(false);
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
    newTopic();
  }
});

init();
