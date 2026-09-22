import { trainingSkillLabels } from "../data/training-bank.mjs";

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function randomScore(seed, value) {
  let state = hash(`${seed}:${value}`) || 1;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296;
}

function inSlot(problem, [minimum, maximum]) {
  return problem.rating >= minimum && problem.rating <= maximum;
}

export function generateTest(bank, mode, { seed = Date.now(), seenProblemIds = /** @type {string[]} */ ([]) } = {}) {
  const seen = new Set(seenProblemIds);
  const selected = [];
  const usedSkills = new Map();

  for (const [slotIndex, slot] of mode.slots.entries()) {
    const eligible = bank.filter((problem) => inSlot(problem, slot) && !selected.includes(problem));
    const fresh = eligible.filter((problem) => !seen.has(problem.id));
    const candidates = fresh.length ? fresh : eligible;
    if (!candidates.length) throw new Error(`题池无法满足 ${mode.name} 的第 ${slotIndex + 1} 个难度位`);

    candidates.sort((left, right) => {
      const skillDifference = (usedSkills.get(left.skill) ?? 0) - (usedSkills.get(right.skill) ?? 0);
      if (skillDifference) return skillDifference;
      return randomScore(seed + slotIndex, left.id) - randomScore(seed + slotIndex, right.id);
    });

    const problem = candidates[0];
    selected.push(problem);
    usedSkills.set(problem.skill, (usedSkills.get(problem.skill) ?? 0) + 1);
  }

  return selected;
}

export function generateRegionalTest(rounds, mode, { seed = Date.now(), seenProblemIds = /** @type {string[]} */ ([]) } = {}) {
  if (!Array.isArray(mode.roles) || !mode.roles.length) throw new Error(`${mode.name} 没有配置训练目标`);
  const seen = new Set(seenProblemIds);
  const eligible = rounds.filter((round) => mode.roles.every((role) => round[role]));
  if (!eligible.length) throw new Error(`真赛题库无法满足 ${mode.name}`);

  eligible.sort((left, right) => {
    const leftFresh = mode.roles.filter((role) => !seen.has(left[role].id)).length;
    const rightFresh = mode.roles.filter((role) => !seen.has(right[role].id)).length;
    if (leftFresh !== rightFresh) return rightFresh - leftFresh;
    return randomScore(seed, left.id) - randomScore(seed, right.id);
  });

  const round = eligible[0];
  return { round, problems: mode.roles.map((role) => round[role]) };
}

export function codeforcesProblemIdFromUrl(value) {
  try {
    const url = new URL(value);
    if (!/(^|\.)codeforces\.com$/i.test(url.hostname)) return null;
    const match = url.pathname.match(/\/(?:problemset\/problem\/(\d+)\/([^/]+)|contest\/(\d+)\/problem\/([^/]+)|gym\/(\d+)\/problem\/([^/]+)|problemset\/gymProblem\/(\d+)\/([^/]+))/i);
    if (!match) return null;
    const gymId = match[5] ?? match[7];
    const index = (match[2] ?? match[4] ?? match[6] ?? match[8]).toUpperCase();
    return gymId ? `gym-${gymId}-${index}` : `${match[1] ?? match[3]}${index}`;
  } catch {
    return null;
  }
}

export function elapsedMilliseconds(session, now = Date.now()) {
  const end = session.pausedAt ?? session.submittedAt ?? now;
  return Math.max(0, end - session.startedAt - (session.totalPausedMs ?? 0));
}

export function summarizeSession(session, bank) {
  const problemById = new Map(bank.map((problem) => [problem.id, problem]));
  const skillStats = new Map();
  let solved = 0;
  let attempted = 0;

  for (const id of session.problemIds) {
    const problem = problemById.get(id);
    if (!problem) continue;
    const status = session.statuses[id] ?? "pending";
    const group = problem.skill ?? problem.role ?? "general";
    const entry = skillStats.get(group) ?? { skill: group, offered: 0, solved: 0, attempted: 0 };
    entry.offered += 1;
    if (status === "solved") {
      solved += 1;
      entry.solved += 1;
    } else if (status === "attempted") {
      attempted += 1;
      entry.attempted += 1;
    }
    skillStats.set(group, entry);
  }

  const weaknesses = [...skillStats.values()]
    .filter((entry) => entry.solved < entry.offered)
    .sort((left, right) => {
      const leftScore = left.attempted * 3 + left.offered - left.solved;
      const rightScore = right.attempted * 3 + right.offered - right.solved;
      return rightScore - leftScore;
    })
    .map((entry) => ({
      ...entry,
      label: trainingSkillLabels[entry.skill] ?? ({ bronze: "铜牌关键题", silver: "银牌差异题", general: "本轮题目" })[entry.skill],
    }));

  return {
    solved,
    attempted,
    skipped: Math.max(0, session.problemIds.length - solved - attempted),
    total: session.problemIds.length,
    weaknesses,
  };
}

export function recommendNext(history = []) {
  if (!history.length) {
    return { modeId: "medal-run", title: "建议先做铜银连续测试", detail: "从同一赛站依次完成铜牌关键题和银牌差异题，限时四小时。" };
  }

  const latest = history[0];
  const solved = Object.values(latest.statuses ?? {}).filter((status) => status === "solved").length;
  const total = latest.problemIds?.length ?? 0;

  if (latest.modeId === "medal-run") {
    if (latest.statuses?.[latest.problemIds?.[0]] !== "solved") {
      return { modeId: "bronze-guard", title: "建议做铜牌题专项", detail: "上一轮第一题未通过，先用单题测试继续训练这一部分。" };
    }
    if (solved < total) {
      return { modeId: "silver-break", title: "建议做银牌题专项", detail: "上一轮铜牌关键题已通过，下一轮单独完成银牌差异题。" };
    }
    return { modeId: "silver-break", title: "建议继续银牌题专项", detail: "上一轮两题均通过，下一轮更换赛站测试银牌差异题。" };
  }

  if (latest.modeId === "bronze-guard") {
    return solved === total && total > 0
      ? { modeId: "medal-run", title: "建议做铜银连续测试", detail: "铜牌关键题已通过，下一轮测试连续完成两题。" }
      : { modeId: "bronze-guard", title: "建议继续铜牌题专项", detail: "更换赛站，再测试一题铜牌关键题。" };
  }

  if (latest.modeId === "silver-break") {
    return solved === total && total > 0
      ? { modeId: "medal-run", title: "建议做铜银连续测试", detail: "银牌差异题已通过，下一轮测试两题连续完成情况。" }
      : { modeId: "silver-break", title: "先补完当前题", detail: "完成复盘并独立复现后，再开始下一场测试。" };
  }

  return { modeId: "medal-run", title: "建议做铜银连续测试", detail: "从同一场区域赛连续完成两道目标题。" };
}
