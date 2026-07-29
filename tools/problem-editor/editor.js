const form = document.querySelector("#problem-form");
const fields = Object.fromEntries(
  ["url", "title", "id", "platform", "solvedAt", "idea", "code", "language"]
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
let saveTimer;
let autoDetectedPlatform = "";

const today = () => new Date().toISOString().slice(0, 10);
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
  toast.timer = setTimeout(() => node.classList.remove("show"), 2200);
}

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
  return null;
}

function generatedIdForDate(date) {
  if (originalId) return originalId;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "保存时自动生成";
  const prefix = date.replaceAll("-", "");
  const largest = problems.reduce((current, problem) => {
    const match = problem.id.match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `${prefix}-${String(largest + 1).padStart(2, "0")}`;
}

function updateGeneratedId() {
  const generated = generatedIdForDate(fields.solvedAt.value);
  fields.id.value = generated === "保存时自动生成" ? "" : generated;
  document.querySelector("#id-display").textContent = generated;
}

function markdownPreview(markdown) {
  const escaped = escapeHtml(markdown || "");
  const blocks = escaped.split(/\n{2,}/);
  return blocks.map((block) => {
    if (block.startsWith("### ")) return `<h3>${inlineMarkdown(block.slice(4))}</h3>`;
    if (block.startsWith("## ")) return `<h2>${inlineMarkdown(block.slice(3))}</h2>`;
    if (block.startsWith("# ")) return `<h2>${inlineMarkdown(block.slice(2))}</h2>`;
    if (/^[-*] /m.test(block)) {
      const items = block.split("\n").filter(Boolean).map((line) => `<li>${inlineMarkdown(line.replace(/^[-*] /, ""))}</li>`).join("");
      return `<ul>${items}</ul>`;
    }
    return `<p>${inlineMarkdown(block).replaceAll("\n", "<br>")}</p>`;
  }).join("") || "<p>解题思路会显示在这里。</p>";
}

function inlineMarkdown(value) {
  return value
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function updatePreview() {
  updateGeneratedId();
  document.querySelector("#preview-title").textContent = fields.title.value || "题目名称";
  document.querySelector("#preview-platform").textContent = fields.platform.value || "PLATFORM";
  document.querySelector("#preview-date").textContent = fields.solvedAt.value || "DATE";
  document.querySelector("#preview-idea").innerHTML = markdownPreview(fields.idea.value);
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
  const normalized = query.trim().toLocaleLowerCase().replace(/\s+/g, "");
  return catalog.filter((tag) => {
    if (selectedTags.has(tag.name)) return false;
    const values = [tag.name, ...(tag.aliases || [])]
      .map((item) => item.toLocaleLowerCase().replace(/\s+/g, ""));
    return !normalized || values.some((item) => item.includes(normalized));
  }).slice(0, 8);
}

function showSuggestions() {
  const matches = matchingTags(tagInput.value);
  const custom = tagInput.value.trim();
  if (custom && !catalog.some((tag) => tag.name.toLocaleLowerCase() === custom.toLocaleLowerCase())) {
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
  selectedTags.add(value);
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
    id: fields.id.value.trim(),
    title: fields.title.value.trim(),
    url: fields.url.value.trim(),
    platform: fields.platform.value.trim(),
    solvedAt: fields.solvedAt.value,
    tags: [...selectedTags],
    idea: fields.idea.value,
    code: fields.code.value,
    language: fields.language.value,
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

function fillForm(problem, isExisting = false) {
  originalId = isExisting ? problem.id : "";
  autoDetectedPlatform = "";
  for (const key of ["url", "title", "id", "platform", "solvedAt", "idea", "code", "language"]) {
    fields[key].value = problem[key] ?? (key === "language" ? "cpp" : "");
  }
  const detected = detectFromUrl(fields.url.value);
  if (detected?.platform === fields.platform.value) autoDetectedPlatform = fields.platform.value;
  selectedTags.clear();
  for (const tag of problem.tags || []) selectedTags.add(tag);
  editorTitle.textContent = isExisting ? "编辑题目" : "新建题目";
  renderSelectedTags();
  setDirty(false);
  renderProblemList();
}

function newProblem(restoreDraft = true) {
  const blank = {
    solvedAt: today(),
    language: "cpp",
    tags: [],
  };
  if (restoreDraft) {
    const saved = localStorage.getItem("problem-editor:new");
    if (saved) {
      try { Object.assign(blank, JSON.parse(saved)); } catch {}
    }
  }
  fillForm(blank, false);
  fields.url.focus();
  sidebar.classList.remove("open");
}

async function loadProblem(id) {
  if (dirty && !confirm("当前修改尚未保存，确定切换题目吗？")) return;
  const response = await fetch(`./api/problems/${encodeURIComponent(id)}`);
  const problem = await response.json();
  if (!response.ok) return toast(problem.error || "读取失败", true);
  const draft = localStorage.getItem(`problem-editor:${id}`);
  if (draft) {
    try {
      const restored = JSON.parse(draft);
      if (confirm("找到这道题的本地草稿，是否恢复？")) Object.assign(problem, restored);
    } catch {}
  }
  fillForm(problem, true);
  sidebar.classList.remove("open");
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
  const response = await fetch("./api/problems");
  problems = await response.json();
  renderProblemList();
}

async function saveProblem() {
  const payload = currentData();
  saveButton.disabled = true;
  saveStateText.textContent = "正在保存…";
  try {
    const response = await fetch("./api/problems", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "保存失败");
    localStorage.removeItem(draftKey());
    originalId = result.id;
    updateGeneratedId();
    editorTitle.textContent = "编辑题目";
    setDirty(false);
    await refreshProblems();
    toast("题目、思路和代码已保存");
  } catch (error) {
    toast(error.message, true);
    setDirty(true);
  } finally {
    saveButton.disabled = false;
  }
}

async function init() {
  const tagResponse = await fetch("./api/tags").catch(() => null);
  if (tagResponse?.ok) catalog = await tagResponse.json();
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
  if (!dirty || confirm("当前修改尚未保存，确定新建题目吗？")) newProblem();
});
document.querySelector("#clear-draft").addEventListener("click", () => {
  if (!confirm("确定放弃当前未保存的修改吗？")) return;
  localStorage.removeItem(draftKey());
  originalId ? loadProblem(originalId) : newProblem(false);
});
document.querySelector("#mobile-list").addEventListener("click", () => sidebar.classList.toggle("open"));
window.addEventListener("beforeunload", (event) => {
  if (!dirty) return;
  event.preventDefault();
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveProblem();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
    event.preventDefault();
    if (!dirty || confirm("当前修改尚未保存，确定新建题目吗？")) newProblem();
  }
});

// The editor serves the same catalog file through this endpoint alias.
init();
