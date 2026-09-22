import { createEditorState, createToast, requestJson, bindEditorShortcuts } from "./shared/editor-state.mjs";
import { createPreview, bindPreviewToggle } from "./shared/preview.mjs";
import { normalizeName, createTagIndex } from "./shared/tags.mjs";
import { languages } from "./shared/languages.mjs";

const fields = Object.fromEntries(
  ["url", "title", "platform", "solvedAt", "statement", "idea", "code", "language"]
    .map((id) => [id, document.querySelector(`#${id}`)]),
);
const selectedTags = new Set();
const tagInput = document.querySelector("#tag-input");
const selectedTagsNode = document.querySelector("#selected-tags");
const suggestionsNode = document.querySelector("#tag-suggestions");
const listNode = document.querySelector("#problem-list");
const listSearch = document.querySelector("#list-search");
const saveButton = document.querySelector("#save-problem");
const saveState = document.querySelector(".save-state");
const saveStateText = document.querySelector("#save-state");
const editorTitle = document.querySelector("#editor-title");
const sidebar = document.querySelector(".sidebar");
let problems = [];
let catalog = [];
let originalId = "";
let dirty = false;
let suggestionIndex = 0;
let loading = false;
let autoDetectedPlatform = "";

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
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
const statementPreview = createPreview(document.querySelector("#preview-statement"));
const ideaPreview = createPreview(document.querySelector("#preview-idea"));
fields.language.innerHTML = Object.entries(languages).map(([value, language]) =>
  '<option value="' + value + '">' + language.label + '</option>').join("");
bindPreviewToggle(document.querySelector("#toggle-preview"), document.querySelector(".app"), "problem-editor:preview");

function setDirty(value) {
  dirty = value;
  saveState.classList.toggle("dirty", value);
  saveState.classList.toggle("saved", !value);
  saveStateText.textContent = value ? "有未保存的修改" : originalId ? "已保存" : "尚未修改";
}

function detectFromUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  const host = url.hostname.replace(/^www\./, "");
  const isHost = (domain) => host === domain || host.endsWith(`.${domain}`);
  if (isHost("codeforces.com")) return { platform: "Codeforces" };
  if (isHost("atcoder.jp")) return { platform: "AtCoder" };
  if (isHost("luogu.com.cn")) return { platform: "洛谷" };
  if (isHost("nowcoder.com")) return { platform: "牛客" };
  if (isHost("matiji.net")) return { platform: "码蹄集" };
  return { platform: host };
}

function updatePreview() {
  document.querySelector("#metadata-summary").textContent = [fields.platform.value, fields.solvedAt.value].filter(Boolean).join(" · ") || "自动填写，可调整";
  document.querySelector("#preview-title").textContent = fields.title.value || "题目名称";
  document.querySelector("#preview-platform").textContent = fields.platform.value || "PLATFORM";
  document.querySelector("#preview-date").textContent = fields.solvedAt.value || "DATE";
  statementPreview(fields.statement.value);
  ideaPreview(fields.idea.value);
  document.querySelector("#preview-code").textContent = fields.code.value || "// 代码预览";
  document.querySelector("#preview-tags").innerHTML = [...selectedTags]
    .map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
}

function renderSelectedTags() {
  selectedTagsNode.innerHTML = [...selectedTags].map((tag) => (
    `<button class="selected-tag" type="button" data-remove-tag="${escapeHtml(tag)}">${escapeHtml(tag)} <span>×</span></button>`
  )).join("");
  selectedTagsNode.querySelectorAll("[data-remove-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedTags.delete(button.dataset.removeTag);
      renderSelectedTags();
      markChanged();
      tagInput.focus();
    });
  });
  updatePreview();
}

function matchingTags(query) {
  const normalized = normalizeName(query);
  return catalog.filter((tag) => {
    if ([...selectedTags].some((selected) => [tag.name, ...(tag.aliases || [])].some((name) => normalizeName(name) === normalizeName(selected)))) return false;
    const values = [tag.name, ...(tag.aliases || [])]
      .map(normalizeName);
    return !normalized || values.some((item) => item.includes(normalized));
  }).slice(0, 8);
}

function showSuggestions() {
  const matches = matchingTags(tagInput.value);
  const custom = tagInput.value.trim();
  if (custom && !catalog.some((tag) => [tag.name, ...(tag.aliases || [])].some((name) => normalizeName(name) === normalizeName(custom)))) {
    matches.push({ name: custom, group: "新标签" });
  }
  suggestionIndex = Math.min(suggestionIndex, Math.max(0, matches.length - 1));
  suggestionsNode.innerHTML = matches.map((tag, index) => (
    `<button type="button" class="${index === suggestionIndex ? "active" : ""}" data-add-tag="${escapeHtml(tag.name)}"><span>${escapeHtml(tag.name)}</span><small>${escapeHtml(tag.group || "")}</small></button>`
  )).join("");
  suggestionsNode.hidden = matches.length === 0;
  suggestionsNode.querySelectorAll("[data-add-tag]").forEach((button) => {
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      addTag(button.dataset.addTag);
    });
  });
}

function addTag(tag) {
  const value = String(tag || "").trim();
  if (!value) return;
  const canonical = createTagIndex(catalog.map((tag) => ({ id: tag.topicId || normalizeName(tag.name), title: tag.name, aliases: tag.aliases }))).canonical([...selectedTags, value]);
  selectedTags.clear();
  canonical.forEach((tag) => selectedTags.add(tag));
  tagInput.value = "";
  suggestionsNode.hidden = true;
  renderSelectedTags();
  markChanged();
}

function draftKey() {
  return `problem-editor:${originalId || "new"}`;
}

function currentData() {
  return {
    originalId,
    title: fields.title.value.trim(),
    url: fields.url.value.trim(),
    platform: fields.platform.value.trim(),
    solvedAt: fields.solvedAt.value,
    tags: [...selectedTags],
    statement: fields.statement.value,
    idea: fields.idea.value,
    code: fields.code.value,
    language: fields.language.value,
  };
}

function markChanged() {
  state.changed();
  updatePreview();
}

function fillForm(problem, isExisting = false, restored = false) {
  originalId = isExisting ? problem.id : "";
  autoDetectedPlatform = "";
  for (const key of ["url", "title", "platform", "solvedAt", "statement", "idea", "code", "language"]) {
    fields[key].value = problem[key] ?? (key === "language" ? "cpp" : "");
  }
  const detected = detectFromUrl(fields.url.value);
  if (detected?.platform === fields.platform.value) autoDetectedPlatform = fields.platform.value;
  selectedTags.clear();
  for (const tag of problem.tags || []) selectedTags.add(tag);
  editorTitle.textContent = isExisting ? "编辑题目" : "新建题目";
  renderSelectedTags();
  state.reset(restored);
  document.querySelector("#statement-details").open = Boolean(fields.statement.value);
  renderProblemList();
}

function newProblem(restoreDraft = true) {
  if (state.saving || loading) return;
  state.flush();
  let restored = false;
  const blank = {
    solvedAt: today(),
    language: "cpp",
    tags: [],
  };
  if (restoreDraft) {
    const saved = localStorage.getItem("problem-editor:new");
    if (saved) {
      try { Object.assign(blank, JSON.parse(saved)); restored = true; } catch {}
    }
  }
  fillForm(blank, false, restored);
  fields.url.focus();
  sidebar.classList.remove("open");
}

async function loadProblem(id, restoreDraft = true) {
  if (state.saving || loading) return;
  state.flush();
  loading = true;
  try {
    const problem = await requestJson("./api/problems/" + encodeURIComponent(id));
    const draft = restoreDraft ? localStorage.getItem("problem-editor:" + id) : null;
    let restored = false;
    if (draft) {
      try { Object.assign(problem, JSON.parse(draft)); restored = true; } catch {}
    }
    fillForm(problem, true, restored);
    sidebar.classList.remove("open");
    if (restored) toast("已恢复这道题的本地草稿");
  } catch (error) { toast(error.message, true); }
  finally { loading = false; }
}

function renderProblemList() {
  const query = listSearch.value.trim().toLocaleLowerCase();
  const visible = problems.filter((problem) =>
    [problem.title, problem.platform, ...(problem.tags || [])].join(" ").toLocaleLowerCase().includes(query)
  );
  listNode.innerHTML = visible.length ? visible.map((problem) => (
    `<button type="button" class="problem-item ${problem.id === originalId ? "active" : ""}" data-problem-id="${problem.id}">
      <strong>${escapeHtml(problem.title)}</strong>
      <span>${escapeHtml(problem.solvedAt)} · ${escapeHtml((problem.tags || []).join(" / "))}</span>
    </button>`
  )).join("") : `<div class="list-empty">${query ? "没有匹配的题目" : "还没有题目，点击右上角 ＋ 开始记录。"}</div>`;
  listNode.querySelectorAll("[data-problem-id]").forEach((button) => {
    button.addEventListener("click", () => loadProblem(button.dataset.problemId));
  });
  document.querySelector("#archive-count").textContent = `${problems.length} 道题`;
}

async function refreshProblems() {
  [problems, catalog] = await Promise.all([requestJson("./api/problems"), requestJson("./api/tags")]);
  renderProblemList();
}

async function saveProblem() {
  if (state.saving || loading) return;
  if (tagInput.value.trim()) addTag(tagInput.value);
  saveButton.disabled = true;
  saveStateText.textContent = "正在保存…";
  try {
    const saved = await state.save((payload) => requestJson("./api/problems", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    }), (result) => {
      originalId = result.id;
      editorTitle.textContent = "编辑题目";
    });
    toast(saved.clean ? "已保存，可以继续记录下一道题" : "已保存，刚刚输入的内容仍在草稿中");
    await refreshProblems().catch(() => toast("内容已保存，列表刷新失败，请稍后重试", true));
  } catch (error) {
    toast(error.message, true);
    setDirty(true);
    const field = error.field === "tags" ? tagInput : fields[error.field];
    if (field) {
      const section = field.closest("details");
      if (section) section.open = true;
      field.focus();
    }
  } finally { saveButton.disabled = false; }
}

async function init() {
  await refreshProblems();
  const requestedId = new URLSearchParams(window.location.search).get("id");
  if (requestedId && problems.some((problem) => problem.id === requestedId)) {
    await loadProblem(requestedId);
  } else {
    newProblem();
  }
}

for (const field of Object.values(fields)) {
  field.addEventListener("input", markChanged);
}
fields.url.addEventListener("input", () => {
  const detected = detectFromUrl(fields.url.value);
  if (!detected) {
    if (autoDetectedPlatform && fields.platform.value === autoDetectedPlatform) {
      fields.platform.value = "";
      autoDetectedPlatform = "";
      updatePreview();
    }
    return;
  }
  if (!fields.platform.value || fields.platform.value === autoDetectedPlatform) {
    fields.platform.value = detected.platform;
    autoDetectedPlatform = detected.platform;
  }
  markChanged();
});
fields.platform.addEventListener("input", () => {
  autoDetectedPlatform = "";
});
fields.code.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const start = fields.code.selectionStart;
  const end = fields.code.selectionEnd;
  fields.code.setRangeText("  ", start, end, "end");
  markChanged();
});
tagInput.addEventListener("focus", showSuggestions);
tagInput.addEventListener("input", () => {
  suggestionIndex = 0;
  showSuggestions();
});
tagInput.addEventListener("keydown", (event) => {
  const matches = [...suggestionsNode.querySelectorAll("[data-add-tag]")];
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (!matches.length) return;
    suggestionIndex = (suggestionIndex + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
    showSuggestions();
  } else if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    const active = suggestionsNode.querySelectorAll("[data-add-tag]")[suggestionIndex];
    addTag(active?.dataset.addTag || tagInput.value);
  } else if (event.key === "Backspace" && !tagInput.value && selectedTags.size) {
    selectedTags.delete([...selectedTags].at(-1));
    renderSelectedTags();
    markChanged();
  }
});
tagInput.addEventListener("blur", () => setTimeout(() => { suggestionsNode.hidden = true; }, 100));
listSearch.addEventListener("input", renderProblemList);
saveButton.addEventListener("click", saveProblem);
document.querySelector("#new-problem").addEventListener("click", () => {
  newProblem();
});
document.querySelector("#clear-draft").addEventListener("click", () => {
  if (state.saving || loading || !confirm("确定放弃当前未保存的修改吗？")) return;
  state.discard();
  setDirty(false);
  originalId ? loadProblem(originalId, false) : newProblem(false);
});
document.querySelector("#mobile-list").addEventListener("click", () => sidebar.classList.toggle("open"));
document.querySelector(".sidebar-backdrop").addEventListener("click", () => sidebar.classList.remove("open"));
bindEditorShortcuts({ save: saveProblem, create: newProblem, isDirty: () => dirty, flush: state.flush });

init().catch((error) => toast(error.message, true));
