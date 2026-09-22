import { createEditorState, createToast, requestJson, bindEditorShortcuts } from "./shared/editor-state.mjs";
import { createPreview, bindPreviewToggle } from "./shared/preview.mjs";
import { normalizeName as normalize } from "./shared/tags.mjs";

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
let loading = false;
let deleting = false;

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const toast = createToast(document.querySelector("#toast"));
const state = createEditorState({
  getKey: draftKey, getData: currentData, setDirty,
  onDraft: () => { saveStateText.textContent = "草稿已自动保存"; },
});
const contentPreview = createPreview(document.querySelector("#preview-content"));
bindPreviewToggle(document.querySelector("#toggle-preview"), document.querySelector(".app"), "topic-editor:preview");

function setDirty(value) {
  dirty = value;
  saveState.classList.toggle("dirty", value);
  saveState.classList.toggle("saved", !value);
  saveStateText.textContent = value ? "有未保存的修改" : currentId ? "知识点已保存" : "尚未保存";
}

function updatePreview() {
  const title = currentTitle || topicNameField.value.trim();
  editorTitle.textContent = currentTitle || "新建标签知识点";
  document.querySelector("#preview-title").textContent = title || "新标签";
  contentPreview(field.value);
  viewTopic.hidden = !currentId;
  deleteButton.hidden = !currentId;
  if (currentId) viewTopic.href = `/problems/tags/${encodeURIComponent(currentId)}`;
}

function draftKey() {
  return `topic-editor:${currentId || (currentTag ? `tag:${normalize(currentTag)}` : "new")}`;
}

function currentData() {
  return {
    originalId: currentId,
    tag: currentTag || topicNameField.value.trim(),
    content: field.value,
  };
}

function markChanged() {
  state.changed();
  updatePreview();
}

function applyTopic(topic, candidateName, isExisting, restored = false) {
  currentId = isExisting ? topic.id : "";
  currentTag = candidateName || topic.title;
  currentTitle = topic.title || candidateName;
  topicNameGroup.hidden = isExisting;
  topicNameField.value = isExisting ? "" : currentTitle;
  field.value = topic.content || "";
  field.setSelectionRange(0, 0);
  field.scrollTop = 0;
  updatePreview();
  state.reset(restored);
  renderTopicList();
  sidebar.classList.remove("open");
  (isExisting ? field : topicNameField).focus();
}

async function loadTopic(id, candidateName = "", restoreDraft = true) {
  if (state.saving || loading || deleting) return;
  state.flush();
  loading = true;
  try {
    const topic = await requestJson("./api/tag-knowledge/" + encodeURIComponent(id));
    const savedDraft = restoreDraft ? localStorage.getItem("topic-editor:" + topic.id) : null;
    let restored = false;
    if (savedDraft) {
      try { topic.content = JSON.parse(savedDraft).content ?? topic.content; restored = true; } catch {}
    }
    applyTopic(topic, candidateName || topic.title, true, restored);
    if (restored) toast("已恢复这个标签的本地草稿");
  } catch (error) { toast(error.message, true); }
  finally { loading = false; }
}

function newTopic(restoreDraft = true) {
  if (state.saving || loading || deleting) return;
  state.flush();
  let restored = false;
  currentId = "";
  currentTag = "";
  currentTitle = "";
  topicNameGroup.hidden = false;
  topicNameField.value = "";
  let content = "";
  const savedDraft = restoreDraft ? localStorage.getItem("topic-editor:new") : null;
  if (savedDraft) {
    try {
      const draft = JSON.parse(savedDraft);
      topicNameField.value = draft.tag ?? "";
      content = draft.content ?? content;
      restored = true;
    } catch {}
  }
  field.value = content;
  updatePreview();
  state.reset(restored);
  renderTopicList();
  sidebar.classList.remove("open");
  topicNameField.focus();
}

function startTag(topic) {
  if (state.saving || loading || deleting) return;
  state.flush();
  let restored = false;
  currentId = "";
  currentTag = topic.name;
  currentTitle = topic.name;
  topicNameGroup.hidden = true;
  topicNameField.value = "";
  let content = "";
  const savedDraft = localStorage.getItem(`topic-editor:tag:${normalize(topic.name)}`);
  if (savedDraft) {
    try {
      content = JSON.parse(savedDraft).content ?? content;
      restored = true;
    } catch {}
  }
  field.value = content;
  updatePreview();
  state.reset(restored);
  renderTopicList();
  sidebar.classList.remove("open");
  field.focus();
}

function renderTopicList() {
  const query = listSearch.value.trim().toLocaleLowerCase();
  const visible = topics.filter((topic) =>
    [topic.name, ...(topic.aliases || [])]
      .join(" ").toLocaleLowerCase().includes(query)
  );

  listNode.innerHTML = visible.length ? visible.map((topic) => (
    `<button type="button" class="problem-item topic-item ${(topic.topicId && topic.topicId === currentId) || (!topic.topicId && topic.name === currentTag) ? "active" : ""}" data-topic-name="${escapeHtml(topic.name)}">
      <strong>${escapeHtml(topic.name)}</strong>
      <span>${topic.count || 0} 道关联题目</span>
    </button>`
  )).join("") : `<div class="list-empty">${query ? "没有匹配的标签。" : "还没有标签，点击右上角 ＋ 新建。"}</div>`;

  listNode.querySelectorAll("[data-topic-name]").forEach((button) => {
    button.addEventListener("click", () => {
      const topic = topics.find((item) => item.name === button.dataset.topicName);
      if (!topic) return;
      if (topic.topicId) loadTopic(topic.topicId, topic.name);
      else startTag(topic);
    });
  });

  document.querySelector("#topic-count").textContent = `${topics.length} 个标签`;
}

async function refreshTopics() {
  topics = await requestJson("./api/tag-knowledge");
  document.querySelector("#known-tags").innerHTML = topics
    .filter((topic) => !topic.topicId)
    .map((topic) => `<option value="${escapeHtml(topic.name)}"></option>`)
    .join("");
  renderTopicList();
}

async function saveTopic() {
  if (state.saving || loading || deleting) return;
  if (!currentData().tag) return toast("请填写新标签名称", true);
  saveButton.disabled = true;
  topicNameField.readOnly = true;
  saveStateText.textContent = "正在保存…";
  try {
    const saved = await state.save((payload) => requestJson("./api/tag-knowledge", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    }), (result) => {
      currentId = result.id;
      currentTag = result.title;
      currentTitle = result.title;
      topicNameGroup.hidden = true;
      updatePreview();
    });
    toast(saved.clean ? "知识点已保存" : "已保存，刚刚输入的内容仍在草稿中");
    await refreshTopics().catch(() => toast("内容已保存，列表刷新失败，请稍后重试", true));
  } catch (error) {
    toast(error.message, true);
    setDirty(true);
  } finally { saveButton.disabled = false; topicNameField.readOnly = false; }
}

async function deleteTopic() {
  if (!currentId || state.saving || loading || deleting) return;
  if (!confirm(`确定删除「${currentTitle}」的知识点吗？此操作会删除对应 Markdown。`)) return;
  deleteButton.disabled = true;
  deleting = true;
  try {
    const response = await fetch(`./api/tag-knowledge/${encodeURIComponent(currentId)}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "删除失败");
    state.discard();
    toast(`已删除「${result.title}」`);
    currentId = "";
    setDirty(false);
    await refreshTopics();
    deleting = false;
    if (topics.length) {
      if (topics[0].topicId) await loadTopic(topics[0].topicId, topics[0].name);
      else startTag(topics[0]);
    } else newTopic(false);
  } catch (error) {
    toast(error.message, true);
  } finally {
    deleteButton.disabled = false;
    deleting = false;
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
      if (topic?.topicId) await loadTopic(topic.topicId, topic.name);
      else if (topic) startTag(topic);
      else {
        newTopic(false);
        topicNameField.value = requestedTag;
        updatePreview();
      }
    } else {
      if (topics.length) {
        if (topics[0].topicId) await loadTopic(topics[0].topicId, topics[0].name);
        else startTag(topics[0]);
      } else newTopic();
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
  if (state.saving || loading || deleting || !confirm("确定放弃当前未保存的修改吗？")) return;
  state.discard();
  setDirty(false);
  if (currentId) loadTopic(currentId, currentTag, false);
  else if (currentTag) {
    const topic = topics.find((item) => item.name === currentTag);
    if (topic) startTag(topic);
  } else newTopic(false);
});
document.querySelector("#mobile-list").addEventListener("click", () => sidebar.classList.toggle("open"));
document.querySelector(".sidebar-backdrop").addEventListener("click", () => sidebar.classList.remove("open"));
bindEditorShortcuts({ save: saveTopic, create: newTopic, isDirty: () => dirty, flush: state.flush });

init();
