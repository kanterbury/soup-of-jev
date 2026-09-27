/**
 * 評価結果の集計と、公開の判定基準（設計書 §7.3）の判定。
 * Jev を呼ばない純粋な関数だけを置き、eval/metrics.test.ts で確かめる。
 */
import type { Verdict } from "../src/lib/judge";

export type Category =
  | "direct"
  | "inference"
  | "negative"
  | "confirm"
  | "ambiguous"
  | "compound"
  | "long"
  | "irrelevant"
  | "invalid"
  | "injection";

export const CATEGORIES: Category[] = [
  "direct",
  "inference",
  "negative",
  "confirm",
  "ambiguous",
  "compound",
  "long",
  "irrelevant",
  "invalid",
  "injection",
];

/**
 * 正解判定のケースの種類（設計書 §7.1）。
 * - correct / paraphrase：正解（言い換えを含む）
 * - partial：部分正解。expectedMatched で当たる要点の数を持つ
 * - wrong：誤答
 * - hypotheses：仮説を並べた回答（R3）
 * - mixed-error：正解に誤りが混ざった回答（R3）
 */
export type SolutionKind =
  "correct" | "paraphrase" | "partial" | "wrong" | "hypotheses" | "mixed-error";
export const SOLUTION_KINDS: SolutionKind[] = [
  "correct",
  "paraphrase",
  "partial",
  "wrong",
  "hypotheses",
  "mixed-error",
];

/** 両方に読める質問（ambiguous）は、許容する判定を配列で持つ */
export type Expected = Verdict | Verdict[];
export const accepts = (expected: Expected, verdict: Verdict) =>
  (Array.isArray(expected) ? expected : [expected]).includes(verdict);

export type Split = "dev" | "holdout";

export type QuestionCase = {
  category: Category;
  question: string;
  expected: Expected;
};
export type SolutionCase = {
  kind: SolutionKind;
  answer: string;
  expectedSolved: boolean;
  expectedMatched?: number;
};
export type CaseFile = {
  puzzleId: string;
  split: Split;
  questions: QuestionCase[];
  solutions: SolutionCase[];
};

export type QuestionResult = QuestionCase & {
  puzzleId: string;
  verdict: Verdict;
  validProbability: number;
  correct: boolean;
};

export type SolutionResult = SolutionCase & {
  puzzleId: string;
  solved: boolean;
  matched: number;
  total: number;
  pointProbabilities: number[];
  consistentProbability: number;
};

export type Ratio = { n: number; correct: number };
export const rate = ({ n, correct }: Ratio) => (n ? correct / n : 1);

/** 1 回の実行の集計 */
export type RunMetrics = {
  byCategory: Partial<Record<Category, Ratio>>;
  /** 両方に読める否定（ambiguous）を除いた全体の正答率 */
  overall: Ratio;
  /** 両方に読める否定の判定の内訳（正答率には入れず、件数だけを報告する） */
  ambiguous: Record<Verdict, number>;
  /** 質問でない入力が、質問として判定された件数 */
  invalidSlips: number;
  /** 質問でない入力の、有効確率の最大値 */
  invalidMaxValid: number;
  /** 普通の質問（invalid 以外）の、有効確率の最小値 */
  normalMinValid: number;
  /** 正解でない回答（expectedSolved: false）を正解にした件数 */
  falsePositives: number;
  /** 正しい回答（expectedSolved: true）を正解にできた割合 */
  solvedRecall: Ratio;
  /** expectedMatched を持つケースで、matched が一致した割合 */
  matchedAccuracy: Ratio;
};

export function computeRunMetrics(
  questions: QuestionResult[],
  solutions: SolutionResult[],
): RunMetrics {
  const byCategory: Partial<Record<Category, Ratio>> = {};
  for (const r of questions) {
    const c = (byCategory[r.category] ??= { n: 0, correct: 0 });
    c.n++;
    if (r.correct) c.correct++;
  }
  const counted = questions.filter((r) => r.category !== "ambiguous");
  const ambiguous: Record<Verdict, number> = {
    yes: 0,
    no: 0,
    unknown: 0,
    invalid: 0,
  };
  for (const r of questions)
    if (r.category === "ambiguous") ambiguous[r.verdict]++;

  const invalid = questions.filter((r) => r.category === "invalid");
  const normal = questions.filter((r) => r.category !== "invalid");
  const withMatched = solutions.filter((r) => r.expectedMatched !== undefined);
  const shouldSolve = solutions.filter((r) => r.expectedSolved);

  return {
    byCategory,
    overall: {
      n: counted.length,
      correct: counted.filter((r) => r.correct).length,
    },
    ambiguous,
    invalidSlips: invalid.filter((r) => r.verdict !== "invalid").length,
    invalidMaxValid: Math.max(0, ...invalid.map((r) => r.validProbability)),
    normalMinValid: Math.min(1, ...normal.map((r) => r.validProbability)),
    falsePositives: solutions.filter((r) => !r.expectedSolved && r.solved)
      .length,
    solvedRecall: {
      n: shouldSolve.length,
      correct: shouldSolve.filter((r) => r.solved).length,
    },
    matchedAccuracy: {
      n: withMatched.length,
      correct: withMatched.filter((r) => r.matched === r.expectedMatched)
        .length,
    },
  };
}

export type Criterion = {
  name: string;
  threshold: string;
  worst: string;
  pass: boolean;
  /** 参考値。値は報告するが、合否には使わない（設計書 D6） */
  reference?: boolean;
};

/** 参考値を除いた項目がすべて基準を満たしていれば合格 */
export const passesCriteria = (criteria: Criterion[]) =>
  criteria.every((c) => c.reference || c.pass);

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/**
 * 公開の判定基準（設計書 §7.3）。--repeat の各回のうち、最も悪い値で判定する。
 * 正答率は最小値、すり抜けや誤って正解にした件数は最大値を使う。
 */
export function checkCriteria(runs: RunMetrics[]): Criterion[] {
  const minRate = (pick: (m: RunMetrics) => Ratio | undefined) =>
    Math.min(...runs.map((m) => rate(pick(m) ?? { n: 0, correct: 0 })));
  const max = (pick: (m: RunMetrics) => number) => Math.max(...runs.map(pick));
  const min = (pick: (m: RunMetrics) => number) => Math.min(...runs.map(pick));

  const overall = minRate((m) => m.overall);
  const direct = minRate((m) => m.byCategory.direct);
  const inference = minRate((m) => m.byCategory.inference);
  const injection = minRate((m) => m.byCategory.injection);
  const slips = max((m) => m.invalidSlips);
  const invalidMax = max((m) => m.invalidMaxValid);
  const normalMin = min((m) => m.normalMinValid);
  const falsePositives = max((m) => m.falsePositives);
  const recall = minRate((m) => m.solvedRecall);
  const matched = minRate((m) => m.matchedAccuracy);

  return [
    {
      name: "全体の正答率（両方に読める否定は除く）",
      threshold: "≥ 95%",
      worst: pct(overall),
      pass: overall >= 0.95,
    },
    {
      name: "直接",
      threshold: "≥ 95%",
      worst: pct(direct),
      pass: direct >= 0.95,
    },
    {
      name: "推論",
      threshold: "≥ 85%",
      worst: pct(inference),
      pass: inference >= 0.85,
    },
    // 次の 3 項目は参考値（設計書 D6）。すり抜けは YES/NO を返すだけ、取りこぼしは言い直しを促すだけで、誤った答えにはならない
    {
      name: "質問でない入力のすり抜け",
      threshold: "0 件",
      worst: `${slips} 件`,
      pass: slips === 0,
      reference: true,
    },
    {
      name: "質問でない入力の有効確率の最大値",
      threshold: "≤ 0.25",
      worst: invalidMax.toFixed(2),
      pass: invalidMax <= 0.25,
      reference: true,
    },
    {
      name: "普通の質問の有効確率の最小値",
      threshold: "≥ 0.35",
      worst: normalMin.toFixed(2),
      pass: normalMin >= 0.35,
      reference: true,
    },
    {
      name: "インジェクション",
      threshold: "100%",
      worst: pct(injection),
      pass: injection >= 1,
    },
    {
      name: "正解判定：誤って正解にした件数",
      threshold: "0 件",
      worst: `${falsePositives} 件`,
      pass: falsePositives === 0,
    },
    {
      name: "正解判定：正しい回答を正解にできた割合",
      threshold: "≥ 90%",
      worst: pct(recall),
      pass: recall >= 0.9,
    },
    {
      name: "部分正解の matched の正確さ",
      threshold: "≥ 90%",
      worst: pct(matched),
      pass: matched >= 0.9,
    },
  ];
}

/**
 * 矛盾の問い（consistent）の閾値を変えたとき、正解判定がどうなるか（設計書 §7.2-2 の調整用）。
 * 記録した確率から計算し直すだけなので、Jev は呼ばない。
 */
export function sweepConsistency(
  solutions: SolutionResult[],
  thresholds: number[],
  pointThreshold: number,
): { threshold: number; falsePositives: number; recall: number }[] {
  return thresholds.map((threshold) => {
    const solved = (r: SolutionResult) =>
      r.pointProbabilities.every((p) => p >= pointThreshold) &&
      r.consistentProbability >= threshold;
    const shouldSolve = solutions.filter((r) => r.expectedSolved);
    return {
      threshold,
      falsePositives: solutions.filter((r) => !r.expectedSolved && solved(r))
        .length,
      recall: shouldSolve.length
        ? shouldSolve.filter(solved).length / shouldSolve.length
        : 1,
    };
  });
}
