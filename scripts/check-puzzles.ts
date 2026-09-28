/**
 * 問題データと評価ケースの検証（設計書 §5.1-7、§7.1）。
 *
 *   npm run check:puzzles
 *
 * 問題データ（data/puzzles）
 * - 必須項目がそろっている
 * - ヒント（hints）がちょうど 3 つある
 * - id とファイル名が一致する
 * - number（一覧の固定の番号）が正の整数で、問題の間で重ならない
 * - 問題ごとに評価ケース（eval/cases/<id>.json）がある
 *
 * 評価ケース（eval/cases）
 * - split が dev か holdout で、両方に問題がある
 * - 質問のカテゴリ・期待値、正解判定の種類が決まった値のどれかである
 * - 部分正解（partial）は expectedMatched を持ち、0 以上・要点の数未満である
 * - 正解（correct / paraphrase）だけが expectedSolved: true である
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CATEGORIES, SOLUTION_KINDS } from "../eval/metrics";

const PUZZLE_DIR = path.join("data", "puzzles");
const CASE_DIR = path.join("eval", "cases");
const VERDICTS = ["yes", "no", "unknown", "invalid"];
/** 問題ごとのヒントの数（設計書 D11） */
const HINT_COUNT = 3;

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "";
const isNonEmptyStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.every(isNonEmptyString);

const errors: string[] = [];
const files = readdirSync(PUZZLE_DIR).filter((f) => f.endsWith(".json"));
const splits = new Set<unknown>();
/** number → その番号を使っているファイル */
const numbers = new Map<number, string>();

function readJson(where: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(where, "utf8"));
  } catch (e) {
    errors.push(`${where}: JSON として読めません（${(e as Error).message}）`);
    return undefined;
  }
}

for (const file of files) {
  const where = path.join(PUZZLE_DIR, file);
  const puzzle = readJson(where);
  if (!puzzle) continue;

  for (const key of ["id", "title", "problem", "truth"]) {
    if (!isNonEmptyString(puzzle[key]))
      errors.push(`${where}: ${key} は空でない文字列にしてください`);
  }
  for (const key of ["facts", "keyPoints", "hints"]) {
    if (!isNonEmptyStringArray(puzzle[key]))
      errors.push(`${where}: ${key} は空でない文字列の配列にしてください`);
  }

  if (Array.isArray(puzzle.hints) && puzzle.hints.length !== HINT_COUNT)
    errors.push(`${where}: hints は ${HINT_COUNT} つにしてください`);

  const number = puzzle.number;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
    errors.push(`${where}: number は 1 以上の整数にしてください`);
  } else if (numbers.has(number)) {
    errors.push(
      `${where}: number（${number}）が ${numbers.get(number)} と重なっています`,
    );
  } else {
    numbers.set(number, where);
  }

  const expectedId = path.basename(file, ".json");
  if (puzzle.id !== expectedId)
    errors.push(
      `${where}: id（${String(puzzle.id)}）をファイル名（${expectedId}）と一致させてください`,
    );

  const casePath = path.join(CASE_DIR, file);
  if (!existsSync(casePath)) {
    errors.push(`${where}: 評価ケース ${casePath} がありません`);
    continue;
  }
  const keyPointCount = isNonEmptyStringArray(puzzle.keyPoints)
    ? puzzle.keyPoints.length
    : 0;
  checkCases(casePath, expectedId, keyPointCount);
}

function checkCases(where: string, puzzleId: string, keyPointCount: number) {
  const cases = readJson(where);
  if (!cases) return;
  if (cases.puzzleId !== puzzleId)
    errors.push(`${where}: puzzleId を ${puzzleId} にしてください`);
  if (cases.split !== "dev" && cases.split !== "holdout")
    errors.push(`${where}: split は dev か holdout にしてください`);
  splits.add(cases.split);

  const questions = Array.isArray(cases.questions)
    ? (cases.questions as Record<string, unknown>[])
    : [];
  if (questions.length === 0) errors.push(`${where}: questions がありません`);
  questions.forEach((q, i) => {
    const at = `${where}: questions[${i}]`;
    if (!CATEGORIES.includes(q.category as never))
      errors.push(`${at}: category が不明です（${String(q.category)}）`);
    if (!isNonEmptyString(q.question)) errors.push(`${at}: question が空です`);
    const expected = Array.isArray(q.expected) ? q.expected : [q.expected];
    if (
      expected.length === 0 ||
      !expected.every((v) => VERDICTS.includes(v as string))
    ) {
      errors.push(
        `${at}: expected が不明です（${JSON.stringify(q.expected)}）`,
      );
    }
    if ((q.category === "ambiguous") !== Array.isArray(q.expected)) {
      errors.push(`${at}: 期待値を配列にするのは ambiguous だけにしてください`);
    }
  });

  const solutions = Array.isArray(cases.solutions)
    ? (cases.solutions as Record<string, unknown>[])
    : [];
  if (solutions.length === 0) errors.push(`${where}: solutions がありません`);
  solutions.forEach((s, i) => {
    const at = `${where}: solutions[${i}]`;
    if (!SOLUTION_KINDS.includes(s.kind as never))
      errors.push(`${at}: kind が不明です（${String(s.kind)}）`);
    if (!isNonEmptyString(s.answer)) errors.push(`${at}: answer が空です`);
    const shouldSolve = s.kind === "correct" || s.kind === "paraphrase";
    if (s.expectedSolved !== shouldSolve)
      errors.push(
        `${at}: kind が ${String(s.kind)} なら expectedSolved は ${shouldSolve} です`,
      );
    if (s.kind === "partial") {
      const m = s.expectedMatched;
      if (
        typeof m !== "number" ||
        !Number.isInteger(m) ||
        m < 0 ||
        m >= keyPointCount
      ) {
        errors.push(
          `${at}: partial の expectedMatched は 0 以上 ${keyPointCount - 1} 以下の整数にしてください`,
        );
      }
    }
  });
}

if (files.length === 0) errors.push(`${PUZZLE_DIR} に問題がありません`);
for (const split of ["dev", "holdout"]) {
  if (files.length > 0 && !splits.has(split))
    errors.push(`split が ${split} の評価ケースがありません`);
}
for (const file of readdirSync(CASE_DIR).filter((f) => f.endsWith(".json"))) {
  if (!files.includes(file))
    errors.push(
      `${path.join(CASE_DIR, file)}: 対応する問題 ${path.join(PUZZLE_DIR, file)} がありません`,
    );
}

if (errors.length > 0) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ ${files.length} 問の問題データと評価ケースを確認しました`);
