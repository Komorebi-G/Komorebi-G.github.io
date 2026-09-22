import test from "node:test";
import assert from "node:assert/strict";
import { createEditorState } from "../tools/shared/editor-state.mjs";
import { renderMarkdown } from "../scripts/lib/markdown.mjs";

function fixture(t) {
  const values = new Map();
  let key = "new";
  let data = { content: "first" };
  let dirty = false;
  const state = createEditorState({
    getKey: () => key, getData: () => ({ ...data }), setDirty: (value) => { dirty = value; }, delay: 60_000,
    storage: { setItem: (k, v) => values.set(k, v), removeItem: (k) => values.delete(k) },
  });
  t.after(() => state.discard());
  return { state, values, get dirty() { return dirty; }, setData: (value) => { data = value; }, setKey: (value) => { key = value; } };
}

test("in-flight edits stay dirty and move to the new record's draft; repeated save is ignored", async (t) => {
  const f = fixture(t);
  let finish;
  let requests = 0;
  f.state.changed();
  const saving = f.state.save((payload) => {
    requests++;
    assert.equal(payload.content, "first");
    return new Promise((resolve) => { finish = resolve; });
  }, () => f.setKey("saved-id"));
  assert.equal(await f.state.save(() => { requests++; }, () => {}), null);
  f.setData({ content: "typed during save" });
  f.state.changed();
  f.state.flush();
  finish({ id: "saved-id" });
  assert.equal((await saving).clean, false);
  assert.equal(requests, 1);
  assert.equal(f.dirty, true);
  assert.equal(JSON.parse(f.values.get("saved-id")).content, "typed during save");
  assert.equal(f.values.has("new"), false);
  await f.state.save(async () => ({}), () => {});
  assert.equal(f.dirty, false);
  assert.equal(f.values.size, 0);
});

test("queued autosave does not recreate an already saved or discarded draft", async (t) => {
  const f = fixture(t);
  f.state.changed();
  await f.state.save(async () => ({}), () => {});
  f.state.flush();
  assert.equal(f.values.size, 0);
  f.state.changed();
  f.state.discard();
  f.state.flush();
  assert.equal(f.values.size, 0);
});

test("switching records flushes the captured document without contaminating the next one", (t) => {
  const f = fixture(t);
  f.state.changed();
  f.setKey("second");
  f.setData({ content: "second document" });
  f.state.reset();
  assert.equal(JSON.parse(f.values.get("new")).content, "first");
  assert.equal(f.values.has("second"), false);
  f.state.reset(true);
  assert.equal(f.dirty, true);
});

test("failed saves preserve the draft and can be retried", async (t) => {
  const f = fixture(t);
  f.state.changed();
  await assert.rejects(f.state.save(async () => { throw new Error("offline"); }, () => {}), /offline/);
  assert.equal(f.state.saving, false);
  assert.equal(f.dirty, true);
  assert.equal(JSON.parse(f.values.get("new")).content, "first");
  await f.state.save(async () => ({}), () => {});
  assert.equal(f.dirty, false);
});

test("shared preview renders fenced code, tables, lists and actual KaTeX", async () => {
  const html = await renderMarkdown("## 标题\n\n$x^2$\n\n```cpp\nint main() {}\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n1. 一\n2. 二");
  assert.match(html, /class="katex"/);
  assert.match(html, /<table>/);
  assert.match(html, /<ol>/);
  assert.match(html, /astro-code/);
});
