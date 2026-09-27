import { describe, expect, it } from "vitest";
import type { JevAnswer, JevClient, JevQuestion, JevState } from "./jev/client";
import {
  judgeQuestion,
  judgeSolution,
  type InternalVerdict,
  type Verdict,
} from "./judge";
import type { Puzzle } from "./puzzles";

const puzzle: Puzzle = {
  id: "test",
  number: 1,
  title: "テスト",
  problem: "問題文",
  truth: "真相",
  facts: ["事実1", "事実2"],
  keyPoints: ["要点1", "要点2", "要点3"],
};

/** 渡された state と questions を記録し、決まった回答を返す偽の JevClient */
function fakeClient(answers: Record<string, JevAnswer>) {
  const calls: { state: JevState; questions: Record<string, JevQuestion> }[] =
    [];
  const client: JevClient = {
    name: "fake",
    async evaluate(state, questions) {
      calls.push({ state, questions });
      return { answers, latencyMs: 0 };
    },
  };
  return { client, calls };
}

const choice = (c: string, confidence?: number): JevAnswer => ({
  type: "choice",
  choice: c,
  confidence,
});
const bool = (probability: number): JevAnswer => ({
  type: "boolean",
  probability,
});

describe("judgeQuestion（設計書 §4.3）", () => {
  const cases: [string, JevAnswer, number, InternalVerdict, Verdict][] = [
    [
      "有効確率が 0.3 未満なら invalid",
      choice("true", 0.99),
      0.29,
      "invalid",
      "invalid",
    ],
    [
      "確信度が 0.5 未満なら uncertain",
      choice("true", 0.49),
      0.9,
      "uncertain",
      "unknown",
    ],
    ["確信度がなければ uncertain", choice("true"), 0.9, "uncertain", "unknown"],
    [
      "「判断できない・無関係」なら irrelevant",
      choice("unknown", 0.9),
      0.9,
      "irrelevant",
      "unknown",
    ],
    [
      "「事実である」なら yes（閾値ちょうどは通す）",
      choice("true", 0.5),
      0.3,
      "yes",
      "yes",
    ],
    ["「事実でない」なら no", choice("false", 0.9), 0.9, "no", "no"],
  ];
  it.each(cases)("%s", async (_, answer, valid, internalVerdict, verdict) => {
    const { client } = fakeClient({ answer, isValidQuestion: bool(valid) });
    const result = await judgeQuestion(client, puzzle, "質問ですか？");
    expect(result.internalVerdict).toBe(internalVerdict);
    expect(result.verdict).toBe(verdict);
  });

  it("state に facts を入れ、keyPoints は入れない", async () => {
    const { client, calls } = fakeClient({
      answer: choice("true", 0.9),
      isValidQuestion: bool(0.9),
    });
    await judgeQuestion(client, puzzle, "質問ですか？");
    expect(calls[0].state).toEqual({
      problem: "問題文",
      truth: "真相",
      facts: ["事実1", "事実2"],
      playerQuestion: "質問ですか？",
    });
  });
});

describe("judgeSolution（設計書 §4.4）", () => {
  it("すべての要点を含み、矛盾がなければ正解", async () => {
    const { client, calls } = fakeClient({
      kp0: bool(0.9),
      kp1: bool(0.8),
      kp2: bool(0.7),
      consistent: bool(0.9),
    });
    const result = await judgeSolution(client, puzzle, "回答");
    expect(result).toMatchObject({ solved: true, matched: 3, total: 3 });
    expect(Object.keys(calls[0].questions)).toEqual([
      "kp0",
      "kp1",
      "kp2",
      "consistent",
    ]);
  });

  it("すべての要点を含んでも、矛盾の問いが低ければ不正解（matched は要点だけで数える）", async () => {
    const { client } = fakeClient({
      kp0: bool(0.9),
      kp1: bool(0.9),
      kp2: bool(0.9),
      consistent: bool(0.69),
    });
    expect(await judgeSolution(client, puzzle, "回答")).toMatchObject({
      solved: false,
      matched: 3,
      total: 3,
    });
  });

  it("要点が欠ければ不正解で、当たった数を返す", async () => {
    const { client } = fakeClient({
      kp0: bool(0.9),
      kp1: bool(0.2),
      kp2: bool(0.69),
      consistent: bool(0.9),
    });
    expect(await judgeSolution(client, puzzle, "回答")).toMatchObject({
      solved: false,
      matched: 1,
      total: 3,
    });
  });
});
