import type { CollectionEntry } from "astro:content";
import type { ProblemEntry } from "./problems";
import { normalizeName } from "./tags.mjs";

export type TopicEntry = CollectionEntry<"tagKnowledge">;

export function getPublishedTopics(topics: TopicEntry[]) {
  return topics
    .filter((topic) => !topic.data.draft)
    .sort((a, b) =>
      a.data.order - b.data.order
      || a.data.title.localeCompare(b.data.title, "zh-CN")
    );
}

export const normalizeTopicName = normalizeName;

export function topicRecords(topics: TopicEntry[]) {
  return topics.map((topic) => ({ id: topic.id, ...topic.data }));
}

export function getTopicNames(topic: TopicEntry) {
  return [topic.data.title, ...topic.data.aliases];
}

export function topicMatchesTag(topic: TopicEntry, tag: string) {
  const normalizedTag = normalizeTopicName(tag);
  return getTopicNames(topic)
    .some((name) => normalizeTopicName(name) === normalizedTag);
}

export function getProblemsForTopic(topic: TopicEntry, problems: ProblemEntry[]) {
  return problems.filter((problem) =>
    problem.data.tags.some((tag) => topicMatchesTag(topic, tag))
  );
}
