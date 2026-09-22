import test from "node:test";
import assert from "node:assert/strict";
import { trainingBank, trainingModes, trainingSkillLabels } from "../src/data/training-bank.mjs";
import {
  codeforcesProblemIdFromUrl,
  elapsedMilliseconds,
  generateTest,
  recommendNext,
  summarizeSession,
} from "../src/lib/training-engine.mjs";

test("curated bank has unique IDs, valid skills and canonical official links", () => {
  assert.equal(trainingBank.length, 47);
  assert.equal(new Set(trainingBank.map((problem) => problem.id)).size, trainingBank.length);
  for (const problem of trainingBank) {
    assert.ok(trainingSkillLabels[problem.skill]);
    assert.equal(problem.url, `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`);
    assert.match(problem.id, /^\d+[A-Z]\d?$/);
  }
});

test("all training modes generate complete, unique and difficulty-valid tests", () => {
  for (const mode of trainingModes) {
    const problems = generateTest(trainingBank, mode, { seed: 20260922 });
    assert.equal(problems.length, mode.slots.length);
    assert.equal(new Set(problems.map((problem) => problem.id)).size, problems.length);
    problems.forEach((problem, index) => {
      const [minimum, maximum] = mode.slots[index];
      assert.ok(problem.rating >= minimum && problem.rating <= maximum);
    });
    assert.ok(new Set(problems.map((problem) => problem.skill)).size >= 3);
  }
});

test("generator avoids seen problems when enough fresh candidates exist and is deterministic", () => {
  const mode = trainingModes.find((entry) => entry.id === "bronze");
  const first = generateTest(trainingBank, mode, { seed: 42 });
  const repeated = generateTest(trainingBank, mode, { seed: 42 });
  const next = generateTest(trainingBank, mode, { seed: 42, seenProblemIds: first.map((problem) => problem.id) });
  assert.deepEqual(repeated.map((problem) => problem.id), first.map((problem) => problem.id));
  assert.equal(next.some((problem) => first.some((seen) => seen.id === problem.id)), false);
});

test("Codeforces archive URLs are recognized in both common formats", () => {
  assert.equal(codeforcesProblemIdFromUrl("https://codeforces.com/problemset/problem/1526/C2"), "1526C2");
  assert.equal(codeforcesProblemIdFromUrl("https://codeforces.com/contest/1526/problem/c2"), "1526C2");
  assert.equal(codeforcesProblemIdFromUrl("https://example.com/problem/1526/C2"), null);
  assert.equal(codeforcesProblemIdFromUrl("not a url"), null);
});

test("summary distinguishes solved, attempted and skipped problems", () => {
  const problems = trainingBank.slice(0, 3);
  const session = {
    problemIds: problems.map((problem) => problem.id),
    statuses: { [problems[0].id]: "solved", [problems[1].id]: "attempted" },
  };
  const summary = summarizeSession(session, trainingBank);
  assert.deepEqual({ solved: summary.solved, attempted: summary.attempted, skipped: summary.skipped }, { solved: 1, attempted: 1, skipped: 1 });
  assert.equal(summary.weaknesses[0].skill, problems[1].skill);
});

test("elapsed time excludes pauses and recommendations follow the latest result", () => {
  assert.equal(elapsedMilliseconds({ startedAt: 1_000, pausedAt: 8_000, totalPausedMs: 2_000 }, 10_000), 5_000);
  assert.equal(recommendNext([]).modeId, "diagnostic");
  assert.equal(recommendNext([{ modeId: "diagnostic", problemIds: ["a", "b", "c", "d", "e"], statuses: { a: "solved", b: "solved", c: "solved", d: "solved" } }]).modeId, "silver");
  assert.equal(recommendNext([{ modeId: "silver", problemIds: ["a", "b", "c", "d", "e"], statuses: { a: "solved" } }]).modeId, "bronze");
});
