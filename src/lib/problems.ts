import type { CollectionEntry } from "astro:content";

export type ProblemEntry = CollectionEntry<"problems">;

export function getPublishedProblems(problems: ProblemEntry[]) {
  return problems
    .filter((problem) => !problem.data.draft)
    .sort((a, b) => b.data.solvedAt.getTime() - a.data.solvedAt.getTime());
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(date);
}

export function getExcerpt(body: string, length = 110) {
  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]()~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > length ? `${plain.slice(0, length).trim()}…` : plain;
}

export function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, "");
}
