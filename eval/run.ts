/**
 * PoC 評価スクリプト。
 *
 *   npm run eval                     # baseline だけ実行
 *   npm run eval -- --all            # 4 つの条件をすべて実行（facts なし / 英語テンプレート / YES/NO 表記も比較）
 *   npm run eval -- --variant=en --puzzle=bar --threshold=0.6
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createJevClient, type JevClient } from "../src/lib/jev/client";
import { DEFAULT_JUDGE_OPTIONS, judgeQuestion, judgeSolution, type JudgeOptions, type QuestionJudgement, type Verdict } from "../src/lib/judge";
import { getPuzzle } from "../src/lib/puzzles";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

type Category = "direct" | "inference" | "negative" | "confirm" | "ambiguous" | "irrelevant" | "invalid" | "injection";
/** 両方に読める質問（ambiguous）は、許容する判定を配列で持つ */
type Expected = Verdict | Verdict[];
const accepts = (expected: Expected, verdict: Verdict) => (Array.isArray(expected) ? expected : [expected]).includes(verdict);
type CaseFile = {
  puzzleId: string;
  questions: { category: Category; question: string; expected: Expected }[];
  solutions: { answer: string; expectedSolved: boolean }[];
};

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const threshold = Number(args.threshold ?? 0.5);
const base: JudgeOptions = { useFacts: true, lang: "ja", labels: "fact", confidenceThreshold: threshold, validThreshold: DEFAULT_JUDGE_OPTIONS.validThreshold };
const VARIANTS: Record<string, JudgeOptions> = {
  baseline: base,
  "no-facts": { ...base, useFacts: false },
  en: { ...base, lang: "en" },
  yesno: { ...base, labels: "yesno" },
};
const variantNames = args.all ? Object.keys(VARIANTS) : [args.variant ?? "baseline"];
const CONCURRENCY = Number(args.concurrency ?? 5);
const PRICE_PER_INPUT_TOKEN = 0.042 / 1_000_000;

const caseFiles: CaseFile[] = readdirSync("eval/cases")
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join("eval/cases", f), "utf8")) as CaseFile)
  .filter((c) => !args.puzzle || c.puzzleId === args.puzzle);

const client = createJevClient();
console.log(`client: ${client.name} / threshold: ${threshold}\n`);

for (const variant of variantNames) {
  const options = VARIANTS[variant];
  if (!options) throw new Error(`不明な variant: ${variant}（${Object.keys(VARIANTS).join(", ")}）`);
  await runVariant(variant, options, client);
}

async function runVariant(variant: string, options: JudgeOptions, client: JevClient) {
  console.log(`=== variant: ${variant} ${JSON.stringify(options)} ===`);

  const questionTasks = caseFiles.flatMap((file) => {
    const puzzle = mustGetPuzzle(file.puzzleId);
    return file.questions.map((c) => async () => {
      const judgement = await judgeQuestion(client, puzzle, c.question, options);
      return { puzzleId: file.puzzleId, ...c, ...judgement, correct: accepts(c.expected, judgement.verdict) };
    });
  });
  const solutionTasks = caseFiles.flatMap((file) => {
    const puzzle = mustGetPuzzle(file.puzzleId);
    return file.solutions.map((c) => async () => {
      const judgement = await judgeSolution(client, puzzle, c.answer, { lang: options.lang });
      return { puzzleId: file.puzzleId, ...c, ...judgement, correct: judgement.solved === c.expectedSolved };
    });
  });

  const questionResults = await runPool(questionTasks, CONCURRENCY);
  const solutionResults = await runPool(solutionTasks, CONCURRENCY);

  printAccuracyByCategory(questionResults);
  printConfusion(questionResults);
  printCalibration(questionResults);
  printSolutions(solutionResults);
  printMisses(questionResults);

  const latencies = [...questionResults, ...solutionResults].map((r) => r.latencyMs).sort((a, b) => a - b);
  const inputTokens = questionResults.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0);
  console.log(
    `latency p50=${percentile(latencies, 0.5).toFixed(0)}ms p95=${percentile(latencies, 0.95).toFixed(0)}ms / ` +
      `質問判定の入力 ${inputTokens} tokens ≒ $${(inputTokens * PRICE_PER_INPUT_TOKEN).toFixed(5)}\n`,
  );

  mkdirSync("eval/results", { recursive: true });
  const outPath = path.join("eval/results", `${new Date().toISOString().replace(/[:.]/g, "-")}-${variant}.json`);
  writeFileSync(outPath, JSON.stringify({ variant, options, client: client.name, questionResults, solutionResults }, null, 2));
  console.log(`結果: ${outPath}\n`);
}

type QuestionResult = QuestionJudgement & { puzzleId: string; category: Category; question: string; expected: Expected; correct: boolean };

function printAccuracyByCategory(results: QuestionResult[]) {
  const categories = [...new Set(results.map((r) => r.category))];
  const rows = categories.map((category) => {
    const rs = results.filter((r) => r.category === category);
    return { category, n: rs.length, accuracy: pct(rs.filter((r) => r.correct).length, rs.length) };
  });
  rows.push({ category: "(全体)" as Category, n: results.length, accuracy: pct(results.filter((r) => r.correct).length, results.length) });
  console.log("カテゴリ別の正答率");
  console.table(rows);
}

function printConfusion(allResults: QuestionResult[]) {
  const labels: Verdict[] = ["yes", "no", "unknown", "invalid"];
  // 期待値が 1 つに決まるケースだけを集計する
  const results = allResults.filter((r) => !Array.isArray(r.expected));
  const table = Object.fromEntries(
    labels.map((expected) => [
      `期待:${expected}`,
      Object.fromEntries(labels.map((actual) => [actual, results.filter((r) => r.expected === expected && r.verdict === actual).length])),
    ]),
  );
  console.log("混同行列（行: 期待値 / 列: 判定）");
  console.table(table);
}

/** answer の confidence 帯ごとに、閾値を適用する前の選択が正しかった割合。閾値の決定に使う。 */
function printCalibration(results: QuestionResult[]) {
  const rawCorrect = (r: QuestionResult) =>
    accepts(r.expected, ({ true: "yes", false: "no", unknown: "unknown" } as const)[r.rawChoice]);
  const targets = results.filter((r) => r.expected !== "invalid" && r.confidence !== undefined);
  const buckets = [0, 0.5, 0.7, 0.8, 0.9, 1.0001];
  const rows = buckets.slice(0, -1).map((lo, i) => {
    const hi = buckets[i + 1];
    const rs = targets.filter((r) => r.confidence! >= lo && r.confidence! < hi);
    return { confidence: `${lo.toFixed(1)}–${Math.min(hi, 1).toFixed(1)}`, n: rs.length, accuracy: pct(rs.filter(rawCorrect).length, rs.length) };
  });
  console.log("確信度の較正（閾値適用前の選択の正答率）");
  console.table(rows);
}

function printSolutions(results: { puzzleId: string; answer: string; expectedSolved: boolean; solved: boolean; pointProbabilities: number[]; correct: boolean }[]) {
  console.log(`正解判定: ${pct(results.filter((r) => r.correct).length, results.length)}`);
  console.table(
    results.map((r) => ({
      puzzle: r.puzzleId,
      expected: r.expectedSolved,
      solved: r.solved,
      points: r.pointProbabilities.map((p) => p.toFixed(2)).join(" "),
      answer: r.answer.slice(0, 30),
    })),
  );
}

function printMisses(results: QuestionResult[]) {
  const misses = results.filter((r) => !r.correct);
  if (misses.length === 0) return;
  console.log("誤判定");
  console.table(
    misses.map((r) => ({
      puzzle: r.puzzleId,
      category: r.category,
      question: r.question,
      expected: String(r.expected),
      verdict: r.verdict,
      raw: r.rawChoice,
      conf: r.confidence?.toFixed(2),
      valid: r.validProbability.toFixed(2),
    })),
  );
}

async function runPool<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
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
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
}

function pct(n: number, d: number) {
  return d ? `${((n / d) * 100).toFixed(1)}% (${n}/${d})` : "-";
}
