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

export function codeforcesProblemIdFromUrl(value) {
  try {
    const url = new URL(value);
    if (!/(^|\.)codeforces\.com$/i.test(url.hostname)) return null;
    const match = url.pathname.match(/\/(?:problemset\/problem\/(\d+)\/([^/]+)|contest\/(\d+)\/problem\/([^/]+))/i);
    if (!match) return null;
    return `${match[1] ?? match[3]}${(match[2] ?? match[4]).toUpperCase()}`;
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
    const entry = skillStats.get(problem.skill) ?? { skill: problem.skill, offered: 0, solved: 0, attempted: 0 };
    entry.offered += 1;
    if (status === "solved") {
      solved += 1;
      entry.solved += 1;
    } else if (status === "attempted") {
      attempted += 1;
      entry.attempted += 1;
    }
    skillStats.set(problem.skill, entry);
  }

  const weaknesses = [...skillStats.values()]
    .filter((entry) => entry.solved < entry.offered)
    .sort((left, right) => {
      const leftScore = left.attempted * 3 + left.offered - left.solved;
      const rightScore = right.attempted * 3 + right.offered - right.solved;
      return rightScore - leftScore;
    })
    .map((entry) => ({ ...entry, label: trainingSkillLabels[entry.skill] }));

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
    return { modeId: "diagnostic", title: "先做一场定位赛", detail: "不用先判断自己缺什么，做完后让结果说话。" };
  }

  const latest = history[0];
  const solved = Object.values(latest.statuses ?? {}).filter((status) => status === "solved").length;
  const total = latest.problemIds?.length ?? 0;

  if (latest.modeId === "diagnostic") {
    return solved >= 4
      ? { modeId: "silver", title: "下一场尝试冲银专项", detail: "定位赛前四题已经能拿住，可以把训练重心向中档题推进。" }
      : { modeId: "bronze", title: "下一场继续稳铜专项", detail: "先把前中段题的识别和实现稳定下来，收益会比盲目加难度更高。" };
  }

  if (latest.modeId === "bronze" && solved === total && total > 0) {
    return { modeId: "silver", title: "下一场尝试冲银专项", detail: "本轮应拿题全部完成，适合增加一道中档攻坚题。" };
  }

  if (latest.modeId === "silver" && solved >= 3) {
    return { modeId: "silver", title: "继续冲银专项", detail: "保留当前强度，优先补完本轮未过题再开下一场。" };
  }

  return { modeId: "bronze", title: "下一场回到稳铜专项", detail: "先提升可解题的转化率，再向更高难度推进。" };
}
