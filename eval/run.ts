/**
 * 評価スクリプト（設計書 §7.2）。実際に Jev を呼ぶので、.env.local の API キーとわずかな費用がかかる。
 *
 *   npm run eval                               # 調整用（dev）を baseline で 1 回
 *   npm run eval -- --all                      # 4 つの条件（baseline / no-facts / en / yesno）を比較
 *   npm run eval -- --repeat=3                 # 同じ条件で 3 回実行し、最小値と平均を出す
 *   npm run eval -- --puzzle=bar --variant=en
 *   npm run eval -- --split=holdout --puzzle=exam,mirror --repeat=3 --confirm-holdout   # 問題を絞る（カンマ区切り）
 *   npm run eval -- --split=holdout --repeat=3 --confirm-holdout
 *                                              # 確認用（holdout）。閾値を凍結した後に 1 回だけ実行する
 *
 * 閾値はアプリと同じ定数（DEFAULT_JUDGE_OPTIONS / DEFAULT_SOLUTION_OPTIONS）を使う。
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  createJevClient,
  JEV_MODEL,
  type JevClient,
} from "../src/lib/jev/client";
import {
  DEFAULT_JUDGE_OPTIONS,
  DEFAULT_SOLUTION_OPTIONS,
  judgeQuestion,
  judgeSolution,
  type JudgeOptions,
  type QuestionJudgement,
  type SolutionJudgement,
  type Verdict,
} from "../src/lib/judge";
import { getPuzzle } from "../src/lib/puzzles";
import {
  accepts,
  CATEGORIES,
  checkCriteria,
  passesCriteria,
  computeRunMetrics,
  rate,
  SOLUTION_KINDS,
  sweepConsistency,
  type CaseFile,
  type QuestionCase,
  type RunMetrics,
  type SolutionCase,
  type Split,
} from "./metrics";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const base: JudgeOptions = DEFAULT_JUDGE_OPTIONS;
const VARIANTS: Record<string, JudgeOptions> = {
  baseline: base,
  "no-facts": { ...base, useFacts: false },
  en: { ...base, lang: "en" },
  yesno: { ...base, labels: "yesno" },
};
const variantNames = args.all
  ? Object.keys(VARIANTS)
  : [args.variant ?? "baseline"];
const split = (args.split ?? "dev") as Split;
const repeat = Number(args.repeat ?? 1);
const CONCURRENCY = Number(args.concurrency ?? 5);
const PRICE_PER_INPUT_TOKEN = 0.042 / 1_000_000;

if (split !== "dev" && split !== "holdout")
  throw new Error(
    `--split は dev か holdout を指定してください（現在: ${split}）`,
  );
if (!Number.isInteger(repeat) || repeat < 1)
  throw new Error(
    `--repeat は 1 以上の整数を指定してください（現在: ${args.repeat}）`,
  );
if (split === "holdout" && !args["confirm-holdout"]) {
  // 確認用データは一度だけ評価する。結果を見て閾値を直したら、新しい確認用データを用意する（設計書 §7.2-3）
  throw new Error(
    "holdout は、閾値と問いの文言を凍結した後に 1 回だけ評価します。実行してよければ --confirm-holdout を付けてください",
  );
}

const caseFiles: CaseFile[] = readdirSync("eval/cases")
  .filter((f) => f.endsWith(".json"))
  .map(
    (f) =>
      JSON.parse(readFileSync(path.join("eval/cases", f), "utf8")) as CaseFile,
  )
  .filter((c) => c.split === split)
  .filter((c) => !args.puzzle || args.puzzle.split(",").includes(c.puzzleId));
if (caseFiles.length === 0)
  throw new Error(
    `split=${split}${args.puzzle ? ` puzzle=${args.puzzle}` : ""} の評価ケースがありません`,
  );

const client = createJevClient();
console.log(
  `client: ${client.name} / split: ${split}（${caseFiles.map((c) => c.puzzleId).join(", ")}）/ repeat: ${repeat}\n` +
    `閾値: confidence ${base.confidenceThreshold} / valid ${base.validThreshold} / ` +
    `point ${DEFAULT_SOLUTION_OPTIONS.pointThreshold} / consistency ${DEFAULT_SOLUTION_OPTIONS.consistencyThreshold}\n`,
);

for (const variant of variantNames) {
  const options = VARIANTS[variant];
  if (!options)
    throw new Error(
      `不明な variant: ${variant}（${Object.keys(VARIANTS).join(", ")}）`,
    );
  await runVariant(variant, options, client);
}

type QuestionResult = QuestionCase &
  QuestionJudgement & { puzzleId: string; correct: boolean };
type SolutionResult = SolutionCase &
  SolutionJudgement & { puzzleId: string; correct: boolean };
type Run = {
  questionResults: QuestionResult[];
  solutionResults: SolutionResult[];
  metrics: RunMetrics;
};

async function runVariant(
  variant: string,
  options: JudgeOptions,
  client: JevClient,
) {
  console.log(`=== variant: ${variant} ${JSON.stringify(options)} ===`);

  const runs: Run[] = [];
  for (let i = 0; i < repeat; i++) {
    if (repeat > 1) console.log(`--- ${i + 1} / ${repeat} 回目 ---`);
    runs.push(await runOnce(options, client));
  }

  printAccuracyByCategory(runs);
  printConfusion(runs.at(-1)!.questionResults);
  printCalibration(runs.flatMap((r) => r.questionResults));
  printValidity(runs);
  printAmbiguous(runs);
  printSolutions(runs);
  printConsistencySweep(runs);
  printMisses(runs);
  printCriteria(runs, variant);

  const allResults = runs.flatMap((r) => [
    ...r.questionResults,
    ...r.solutionResults,
  ]);
  const latencies = allResults.map((r) => r.latencyMs).sort((a, b) => a - b);
  const inputTokens = runs
    .flatMap((r) => r.questionResults)
    .reduce((sum, r) => sum + (r.inputTokens ?? 0), 0);
  console.log(
    `latency p50=${percentile(latencies, 0.5).toFixed(0)}ms p95=${percentile(latencies, 0.95).toFixed(0)}ms / ` +
      `質問判定の入力 ${inputTokens} tokens ≒ $${(inputTokens * PRICE_PER_INPUT_TOKEN).toFixed(5)}\n`,
  );

  mkdirSync("eval/results", { recursive: true });
  const outPath = path.join(
    "eval/results",
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${split}-${variant}.json`,
  );
  const solutionOptions = { ...DEFAULT_SOLUTION_OPTIONS, lang: options.lang };
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        variant,
        split,
        repeat,
        puzzles: caseFiles.map((c) => c.puzzleId),
        client: client.name,
        model: JEV_MODEL,
        options,
        solutionOptions,
        criteria: checkCriteria(runs.map((r) => r.metrics)),
        runs,
      },
      null,
      2,
    ),
  );
  console.log(`結果: ${outPath}\n`);
}

async function runOnce(options: JudgeOptions, client: JevClient): Promise<Run> {
  const questionTasks = caseFiles.flatMap((file) => {
    const puzzle = mustGetPuzzle(file.puzzleId);
    return file.questions.map((c) => async (): Promise<QuestionResult> => {
      const judgement = await judgeQuestion(
        client,
        puzzle,
        c.question,
        options,
      );
      return {
        puzzleId: file.puzzleId,
        ...c,
        ...judgement,
        correct: accepts(c.expected, judgement.verdict),
      };
    });
  });
  const solutionTasks = caseFiles.flatMap((file) => {
    const puzzle = mustGetPuzzle(file.puzzleId);
    return file.solutions.map((c) => async (): Promise<SolutionResult> => {
      const judgement = await judgeSolution(client, puzzle, c.answer, {
        lang: options.lang,
      });
      return {
        puzzleId: file.puzzleId,
        ...c,
        ...judgement,
        correct: judgement.solved === c.expectedSolved,
      };
    });
  });

  const questionResults = await runPool(questionTasks, CONCURRENCY);
  const solutionResults = await runPool(solutionTasks, CONCURRENCY);
  return {
    questionResults,
    solutionResults,
    metrics: computeRunMetrics(questionResults, solutionResults),
  };
}

function printAccuracyByCategory(runs: Run[]) {
  const row = (
    label: string,
    pick: (m: RunMetrics) => { n: number; correct: number } | undefined,
  ) => {
    const ratios = runs
      .map((r) => pick(r.metrics))
      .filter((x) => x !== undefined);
    if (ratios.length === 0) return undefined;
    const rates = ratios.map(rate);
    return {
      category: label,
      n: ratios[0].n,
      min: pct(Math.min(...rates)),
      mean: pct(rates.reduce((a, b) => a + b, 0) / rates.length),
      each: ratios.map((x) => `${x.correct}/${x.n}`).join(" "),
    };
  };
  const rows = [
    ...CATEGORIES.map((c) => row(c, (m) => m.byCategory[c])),
    row("(全体・ambiguous を除く)", (m) => m.overall),
  ].filter((x) => x !== undefined);
  console.log("カテゴリ別の正答率");
  console.table(rows);
}

function printConfusion(results: QuestionResult[]) {
  const labels: Verdict[] = ["yes", "no", "unknown", "invalid"];
  // 期待値が 1 つに決まるケースだけを集計する
  const single = results.filter((r) => !Array.isArray(r.expected));
  const table = Object.fromEntries(
    labels.map((expected) => [
      `期待:${expected}`,
      Object.fromEntries(
        labels.map((actual) => [
          actual,
          single.filter((r) => r.expected === expected && r.verdict === actual)
            .length,
        ]),
      ),
    ]),
  );
  console.log(`混同行列（最後の回。行: 期待値 / 列: 判定）`);
  console.table(table);
}

/** answer の confidence 帯ごとに、閾値を適用する前の選択が正しかった割合 */
function printCalibration(results: QuestionResult[]) {
  const rawCorrect = (r: QuestionResult) =>
    accepts(
      r.expected,
      ({ true: "yes", false: "no", unknown: "unknown" } as const)[r.rawChoice],
    );
  const targets = results.filter(
    (r) => r.expected !== "invalid" && r.confidence !== undefined,
  );
  const buckets = [0, 0.5, 0.7, 0.8, 0.9, 1.0001];
  const rows = buckets.slice(0, -1).map((lo, i) => {
    const hi = buckets[i + 1];
    const rs = targets.filter((r) => r.confidence! >= lo && r.confidence! < hi);
    return {
      confidence: `${lo.toFixed(1)}–${Math.min(hi, 1).toFixed(1)}`,
      n: rs.length,
      accuracy: ratioText(rs.filter(rawCorrect).length, rs.length),
    };
  });
  console.log("確信度の較正（全回。閾値適用前の選択の正答率）");
  console.table(rows);
}

/** 有効確率の分布の揺れ（設計書 §7.2-4） */
function printValidity(runs: Run[]) {
  console.log("有効確率（回ごと）");
  console.table(
    runs.map((r, i) => ({
      run: i + 1,
      普通の質問の最小値: r.metrics.normalMinValid.toFixed(2),
      質問でない入力の最大値: r.metrics.invalidMaxValid.toFixed(2),
      すり抜け: r.metrics.invalidSlips,
    })),
  );
}

/** 両方に読める否定は YES/NO のどちらでも正解にしているので、正答率には入れず件数だけを出す（設計書 §7.3） */
function printAmbiguous(runs: Run[]) {
  console.log("両方に読める否定の判定（回ごとの件数）");
  console.table(runs.map((r, i) => ({ run: i + 1, ...r.metrics.ambiguous })));
}

function printSolutions(runs: Run[]) {
  console.log("正解判定（回ごと）");
  console.table(
    runs.map((r, i) => ({
      run: i + 1,
      誤って正解: r.metrics.falsePositives,
      正解にできた割合: ratioText(
        r.metrics.solvedRecall.correct,
        r.metrics.solvedRecall.n,
      ),
      "matched の正確さ": ratioText(
        r.metrics.matchedAccuracy.correct,
        r.metrics.matchedAccuracy.n,
      ),
    })),
  );

  const last = runs.at(-1)!.solutionResults;
  console.log("正解判定の詳細（最後の回）");
  console.table(
    SOLUTION_KINDS.flatMap((kind) => last.filter((r) => r.kind === kind)).map(
      (r) => ({
        puzzle: r.puzzleId,
        kind: r.kind,
        expected: r.expectedSolved,
        solved: r.solved,
        matched:
          r.expectedMatched === undefined
            ? `${r.matched}`
            : `${r.matched}（期待 ${r.expectedMatched}）`,
        points: r.pointProbabilities.map((p) => p.toFixed(2)).join(" "),
        consistent: r.consistentProbability.toFixed(2),
        ok:
          r.correct &&
          (r.expectedMatched === undefined || r.matched === r.expectedMatched)
            ? ""
            : "✗",
        answer: r.answer.slice(0, 24),
      }),
    ),
  );
}

/** 矛盾の問いの閾値を dev で決めるための表。記録した確率から計算し直す（Jev は呼ばない） */
function printConsistencySweep(runs: Run[]) {
  const thresholds = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9];
  const perRun = runs.map((r) =>
    sweepConsistency(
      r.solutionResults,
      thresholds,
      DEFAULT_SOLUTION_OPTIONS.pointThreshold,
    ),
  );
  console.log(
    `矛盾の問いの閾値を変えた場合（全回のうち最悪の値。現在の値: ${DEFAULT_SOLUTION_OPTIONS.consistencyThreshold}）`,
  );
  console.table(
    thresholds.map((threshold, i) => ({
      threshold,
      "誤って正解（最大）": Math.max(...perRun.map((s) => s[i].falsePositives)),
      "正解にできた割合（最小）": pct(
        Math.min(...perRun.map((s) => s[i].recall)),
      ),
    })),
  );
}

function printMisses(runs: Run[]) {
  // 同じ質問が何回外れたかをまとめる
  const misses = new Map<
    string,
    { r: QuestionResult; count: number; verdicts: Verdict[] }
  >();
  for (const run of runs) {
    for (const r of run.questionResults.filter((x) => !x.correct)) {
      const key = `${r.puzzleId}\u0000${r.question}`;
      const entry = misses.get(key) ?? { r, count: 0, verdicts: [] };
      entry.count++;
      entry.verdicts.push(r.verdict);
      misses.set(key, entry);
    }
  }
  if (misses.size === 0) return;
  console.log("誤判定");
  console.table(
    [...misses.values()].map(({ r, count, verdicts }) => ({
      puzzle: r.puzzleId,
      category: r.category,
      question: r.question.slice(0, 40),
      expected: String(r.expected),
      verdicts: verdicts.join(","),
      misses: `${count}/${runs.length}`,
      raw: r.rawChoice,
      conf: r.confidence?.toFixed(2),
      valid: r.validProbability.toFixed(2),
    })),
  );
}

function printCriteria(runs: Run[], variant: string) {
  const criteria = checkCriteria(runs.map((r) => r.metrics));
  console.log(
    `公開の判定基準（設計書 §7.3。split=${split}、variant=${variant}、${runs.length} 回のうち最悪の値）`,
  );
  console.table(
    criteria.map((c) => ({
      項目: c.reference ? `${c.name}（参考値）` : c.name,
      基準: c.threshold,
      結果: c.worst,
      判定: c.pass ? "✓" : c.reference ? "△" : "✗",
    })),
  );
  console.log(
    `結論：${passesCriteria(criteria) ? "合格" : "不合格"}（参考値の項目は合否に使わない。設計書 D6）`,
  );
  if (variant !== "baseline" || split !== "holdout" || runs.length < 3) {
    console.log(
      "※ 公開の判定に使うのは、holdout・baseline・--repeat=3 の結果だけ\n",
    );
  }
}

async function runPool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        results[i] = await tasks[i]();
      }
    }),
  );
  return results;
}

function mustGetPuzzle(id: string) {
  const puzzle = getPuzzle(id);
  if (!puzzle) throw new Error(`data/puzzles に ${id} がありません`);
  return puzzle;
}

function percentile(sorted: number[], p: number) {
  return sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
    : 0;
}

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

function ratioText(n: number, d: number) {
  return d ? `${((n / d) * 100).toFixed(1)}% (${n}/${d})` : "-";
}
