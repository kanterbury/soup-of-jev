import { describe, expect, it } from "vitest";
import type { Verdict } from "../src/lib/judge";
import {
  checkCriteria,
  computeRunMetrics,
  passesCriteria,
  sweepConsistency,
  type Category,
  type Expected,
  type QuestionResult,
  type SolutionResult,
} from "./metrics";

const q = (category: Category, expected: Expected, verdict: Verdict, validProbability = 0.9): QuestionResult => ({
  puzzleId: "p",
  category,
  question: "質問",
  expected,
  verdict,
  validProbability,
  correct: (Array.isArray(expected) ? expected : [expected]).includes(verdict),
});

const s = (
  expectedSolved: boolean,
  solved: boolean,
  { matched = 3, expectedMatched, points = [0.9, 0.9, 0.9], consistent = 0.9 }: Partial<{
    matched: number;
    expectedMatched: number;
    points: number[];
    consistent: number;
  }> = {},
): SolutionResult => ({
  puzzleId: "p",
  kind: expectedSolved ? "correct" : "wrong",
  answer: "回答",
  expectedSolved,
  expectedMatched,
  solved,
  matched,
  total: 3,
  pointProbabilities: points,
  consistentProbability: consistent,
});

describe("computeRunMetrics", () => {
  it("全体の正答率から ambiguous を除き、件数だけを数える", () => {
    const m = computeRunMetrics(
      [q("direct", "yes", "yes"), q("direct", "no", "unknown"), q("ambiguous", ["yes", "no"], "yes"), q("ambiguous", ["yes", "no"], "no")],
      [],
    );
    expect(m.overall).toEqual({ n: 2, correct: 1 });
    expect(m.byCategory.ambiguous).toEqual({ n: 2, correct: 2 });
    expect(m.ambiguous).toEqual({ yes: 1, no: 1, unknown: 0, invalid: 0 });
  });

  it("有効確率は、質問でない入力の最大値と、それ以外の最小値を取る", () => {
    const m = computeRunMetrics(
      [q("invalid", "invalid", "invalid", 0.1), q("invalid", "invalid", "yes", 0.31), q("direct", "yes", "yes", 0.4), q("injection", "no", "no", 0.8)],
      [],
    );
    expect(m.invalidMaxValid).toBe(0.31);
    expect(m.normalMinValid).toBe(0.4);
    expect(m.invalidSlips).toBe(1);
  });

  it("正解判定は、誤って正解にした件数・正解にできた割合・matched の正確さを数える", () => {
    const m = computeRunMetrics(
      [],
      [
        s(true, true),
        s(true, false),
        s(false, true),
        s(false, false, { matched: 1, expectedMatched: 1 }),
        s(false, false, { matched: 2, expectedMatched: 1 }),
      ],
    );
    expect(m.falsePositives).toBe(1);
    expect(m.solvedRecall).toEqual({ n: 2, correct: 1 });
    expect(m.matchedAccuracy).toEqual({ n: 2, correct: 1 });
  });
});

describe("checkCriteria", () => {
  const perfect = computeRunMetrics(
    [q("direct", "yes", "yes", 0.9), q("inference", "no", "no", 0.9), q("injection", "no", "no", 0.9), q("invalid", "invalid", "invalid", 0.1)],
    [s(true, true), s(false, false, { matched: 1, expectedMatched: 1 })],
  );

  it("すべて満たせば合格", () => {
    expect(checkCriteria([perfect]).every((c) => c.pass)).toBe(true);
  });

  it("複数回のうち最も悪い回で判定する", () => {
    const bad = computeRunMetrics(
      [q("direct", "yes", "no", 0.9), q("invalid", "invalid", "invalid", 0.26)],
      [s(false, true)],
    );
    const failed = checkCriteria([perfect, bad])
      .filter((c) => !c.pass)
      .map((c) => c.name);
    expect(failed).toEqual(
      expect.arrayContaining(["直接", "質問でない入力の有効確率の最大値", "正解判定：誤って正解にした件数"]),
    );
  });

  it("参考値の項目（有効確率・すり抜け）だけが基準に届かなくても合格にする", () => {
    const leaky = computeRunMetrics(
      // 有効確率の余裕だけが足りない（正答率に響かない形で、参考値の 2 項目を外す）
      [q("direct", "yes", "yes", 0.12), q("inference", "no", "no", 0.9), q("injection", "no", "no", 0.9), q("invalid", "invalid", "invalid", 0.29)],
      [s(true, true), s(false, false, { matched: 1, expectedMatched: 1 })],
    );
    const criteria = checkCriteria([leaky]);
    expect(criteria.filter((c) => !c.pass).every((c) => c.reference)).toBe(true);
    expect(passesCriteria(criteria)).toBe(true);
    expect(passesCriteria(checkCriteria([perfect, computeRunMetrics([q("direct", "yes", "no")], [])]))).toBe(false);
  });
});

describe("sweepConsistency", () => {
  it("記録した確率から、閾値ごとの正解判定を計算し直す", () => {
    const results = [
      s(true, true, { consistent: 0.8 }),
      s(false, true, { consistent: 0.72 }), // 仮説の羅列：要点はそろうが矛盾の問いが低め
      s(false, false, { points: [0.9, 0.1, 0.9], consistent: 0.95 }),
    ];
    expect(sweepConsistency(results, [0.7, 0.75, 0.85], 0.7)).toEqual([
      { threshold: 0.7, falsePositives: 1, recall: 1 },
      { threshold: 0.75, falsePositives: 0, recall: 1 },
      { threshold: 0.85, falsePositives: 0, recall: 0 },
    ]);
  });
});
