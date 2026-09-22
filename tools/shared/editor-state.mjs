// Shared by both editors. Draft timers capture a document and its data, never
// whichever form happens to be open when the timer eventually runs.
export function createEditorState({ getKey, getData, setDirty, onDraft = () => {}, storage = localStorage, delay = 500 }) {
  let revision = 0;
  let saving = false;
  let timer;
  let pending;

  function flush() {
    clearTimeout(timer);
    if (!pending) return;
    storage.setItem(pending.key, JSON.stringify(pending.data));
    pending = undefined;
    if (!saving) onDraft();
  }

  function discard() {
    clearTimeout(timer);
    pending = undefined;
    storage.removeItem(getKey());
  }

  return {
    get saving() { return saving; },
    flush,
    discard,
    reset(dirty = false) {
      flush();
      revision = 0;
      setDirty(dirty);
    },
    changed() {
      revision += 1;
      setDirty(true);
      clearTimeout(timer);
      pending = { key: getKey(), data: getData() };
      timer = setTimeout(flush, delay);
    },
    async save(send, commit) {
      if (saving) return null;
      saving = true;
      const version = revision;
      const key = getKey();
      try {
        flush();
        const result = await send(getData());
        clearTimeout(timer);
        pending = undefined;
        commit(result);
        const clean = revision === version;
        if (clean) storage.removeItem(key);
        else {
          // A new record now has an ID; move any edits made in flight to that ID.
          storage.setItem(getKey(), JSON.stringify(getData()));
          if (key !== getKey()) storage.removeItem(key);
        }
        setDirty(!clean);
        return { result, clean };
      } finally { saving = false; }
    },
  };
}

export async function requestJson(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || "请求失败");
    error.field = result.field;
    throw error;
  }
  return result;
}

export function createToast(node, duration = 2400) {
  let timer;
  return (message, error = false) => {
    node.textContent = message;
    node.classList.toggle("error", error);
    node.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => node.classList.remove("show"), duration);
  };
}

export function bindEditorShortcuts({ save, create, isDirty, flush }) {
  window.addEventListener("beforeunload", (event) => {
    flush();
    if (!isDirty()) return;
    event.preventDefault();
  });
  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "s" || key === "n") {
      event.preventDefault();
      (key === "s" ? save : create)();
    }
  });
}
