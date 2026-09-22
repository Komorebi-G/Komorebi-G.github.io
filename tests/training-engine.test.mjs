import test from "node:test";
import assert from "node:assert/strict";
import {
  cfDrillBank,
  cfDrillModes,
  regionalRounds,
  trainingBank,
  trainingModes,
  trainingSkillLabels,
} from "../src/data/training-bank.mjs";
import {
  codeforcesProblemIdFromUrl,
  elapsedMilliseconds,
  generateRegionalTest,
  generateTest,
  recommendNext,
  summarizeSession,
} from "../src/lib/training-engine.mjs";

test("regional bank uses unique real Gym problems with transparent scoreboard data", () => {
  assert.equal(regionalRounds.length, 7);
  assert.equal(trainingBank.length, 14);
  assert.equal(new Set(trainingBank.map((problem) => problem.id)).size, trainingBank.length);
  for (const round of regionalRounds) {
    assert.ok(round.officialTeams >= 280);
    assert.ok(round.medalLine.bronze >= 2);
    assert.ok(round.medalLine.silver >= round.medalLine.bronze);
    assert.match(round.scoreboardUrl, /^https:\/\/board\.xcpcio\.com\/board\//);
    for (const role of ["bronze", "silver"]) {
      const problem = round[role];
      assert.equal(problem.role, role);
      assert.match(problem.url, new RegExp(`^https://codeforces\\.com/problemset/gymProblem/${problem.gymId}/${problem.index}$`));
      assert.ok(problem.solveRates[role] >= 50);
    }
    assert.ok(round.silver.solveRates.silver > round.silver.solveRates.bronze);
  }
});

test("every real-contest mode selects the requested roles from one contest", () => {
  for (const mode of trainingModes) {
    const result = generateRegionalTest(regionalRounds, mode, { seed: 20260923 });
    assert.deepEqual(result.problems.map((problem) => problem.role), mode.roles);
    assert.ok(result.problems.every((problem) => problem.title.startsWith(result.round.name)));
    assert.equal(new Set(result.problems.map((problem) => problem.id)).size, result.problems.length);
  }
});

test("real-contest generator is deterministic and rotates away from seen rounds", () => {
  const mode = trainingModes.find((entry) => entry.id === "medal-run");
  const first = generateRegionalTest(regionalRounds, mode, { seed: 42 });
  const repeated = generateRegionalTest(regionalRounds, mode, { seed: 42 });
  const next = generateRegionalTest(regionalRounds, mode, {
    seed: 42,
    seenProblemIds: first.problems.map((problem) => problem.id),
  });
  assert.equal(repeated.round.id, first.round.id);
  assert.notEqual(next.round.id, first.round.id);
});

test("Codeforces drill pool remains a separate validated supplement", () => {
  assert.equal(cfDrillBank.length, 47);
  assert.equal(new Set(cfDrillBank.map((problem) => problem.id)).size, cfDrillBank.length);
  for (const problem of cfDrillBank) {
    assert.ok(trainingSkillLabels[problem.skill]);
    assert.equal(problem.url, `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`);
  }
  for (const mode of cfDrillModes) {
    const problems = generateTest(cfDrillBank, mode, { seed: 20260923 });
    assert.equal(problems.length, mode.slots.length);
  }
});

test("Codeforces archive URLs recognize regular and Gym problem formats", () => {
  assert.equal(codeforcesProblemIdFromUrl("https://codeforces.com/problemset/problem/1526/C2"), "1526C2");
  assert.equal(codeforcesProblemIdFromUrl("https://codeforces.com/contest/1526/problem/c2"), "1526C2");
  assert.equal(codeforcesProblemIdFromUrl("https://codeforces.com/gym/105540/problem/i"), "gym-105540-I");
  assert.equal(codeforcesProblemIdFromUrl("https://codeforces.com/problemset/gymProblem/105540/I"), "gym-105540-I");
  assert.equal(codeforcesProblemIdFromUrl("https://example.com/problem/1526/C2"), null);
});

test("summary distinguishes solved, attempted and skipped medal targets", () => {
  const problems = trainingBank.slice(0, 2);
  const session = {
    problemIds: problems.map((problem) => problem.id),
    statuses: { [problems[0].id]: "solved", [problems[1].id]: "attempted" },
  };
  const summary = summarizeSession(session, trainingBank);
  assert.deepEqual(
    { solved: summary.solved, attempted: summary.attempted, skipped: summary.skipped },
    { solved: 1, attempted: 1, skipped: 0 },
  );
  assert.equal(summary.weaknesses[0].label, "银牌差异题");
});

test("elapsed time excludes pauses and recommendations follow the main-solver role", () => {
  assert.equal(elapsedMilliseconds({ startedAt: 1_000, pausedAt: 8_000, totalPausedMs: 2_000 }, 10_000), 5_000);
  assert.equal(recommendNext([]).modeId, "medal-run");
  assert.equal(recommendNext([{
    modeId: "medal-run",
    problemIds: ["bronze", "silver"],
    statuses: { bronze: "attempted" },
  }]).modeId, "bronze-guard");
  assert.equal(recommendNext([{
    modeId: "medal-run",
    problemIds: ["bronze", "silver"],
    statuses: { bronze: "solved", silver: "attempted" },
  }]).modeId, "silver-break");
  assert.equal(recommendNext([{
    modeId: "bronze-guard",
    problemIds: ["bronze"],
    statuses: { bronze: "solved" },
  }]).modeId, "medal-run");
});
