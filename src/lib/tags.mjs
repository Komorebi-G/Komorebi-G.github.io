/** @param {string} value */
export function normalizeName(value) {
  return value.normalize("NFC").toLowerCase().replace(/[\s_-]+/g, "");
}

/** @param {string} value */
export function contentId(value) {
  const id = value.normalize("NFC").trim().toLowerCase()
    .replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(id)) throw new Error("无效的内容标识");
  return id;
}

/** @typedef {{ id: string, title: string, aliases?: string[] }} Topic */
/** @param {Topic[]} topics */
export function createTagIndex(topics) {
  /** @type {Map<string, Topic>} */
  const byName = new Map();
  for (const topic of topics) {
    for (const name of [topic.title, ...(topic.aliases || [])]) {
      const key = normalizeName(name);
      if (!key) throw new Error("标签名称不能为空");
      const owner = byName.get(key);
      if (owner && owner.id !== topic.id) {
        throw new Error(`标签「${name}」同时属于「${owner.title}」和「${topic.title}」`);
      }
      byName.set(key, topic);
    }
  }
  return {
    /** @param {string} tag */
    find: (tag) => byName.get(normalizeName(tag)),
    /** @param {string} tag */
    key: (tag) => normalizeName(byName.get(normalizeName(tag))?.title ?? tag),
    /** @param {string[]} tags */
    canonical(tags) {
      const unique = new Map();
      for (const tag of tags) {
        const name = byName.get(normalizeName(tag))?.title ?? tag.trim();
        const key = normalizeName(name);
        if (!key) throw new Error("标签名称不能为空");
        if (!unique.has(key)) unique.set(key, name);
      }
      return [...unique.values()];
    },
  };
}

/** @param {{tags: string[]}[]} problems @param {Topic[]} topics */
export function buildTagCatalog(problems, topics) {
  const index = createTagIndex(topics);
  const entries = new Map(topics.map((topic) => [index.key(topic.title), {
    name: topic.title, aliases: topic.aliases || [], topicId: topic.id, count: 0,
  }]));
  for (const problem of problems) {
    for (const name of index.canonical(problem.tags)) {
      const key = index.key(name);
      const entry = entries.get(key) ?? { name, aliases: [], topicId: "", count: 0 };
      entry.count += 1;
      entries.set(key, entry);
    }
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}
