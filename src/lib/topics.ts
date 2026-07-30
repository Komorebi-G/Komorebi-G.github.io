import type { CollectionEntry } from "astro:content";
import type { ProblemEntry } from "./problems";

export type TopicEntry = CollectionEntry<"topics">;

export function getPublishedTopics(topics: TopicEntry[]) {
  return topics
    .filter((topic) => !topic.data.draft)
    .sort((a, b) =>
      a.data.order - b.data.order
      || a.data.title.localeCompare(b.data.title, "zh-CN")
    );
}

export function normalizeTopicName(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[\s_-]+/g, "");
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

export function findTopicForTag(topics: TopicEntry[], tag: string) {
  return topics.find((topic) => topicMatchesTag(topic, tag));
}
