/**
 * 問題データの検証（設計書 §5.1-7）。
 *
 *   npm run check:puzzles
 *
 * - 必須項目がそろっている
 * - id とファイル名が一致する
 * - 問題ごとに評価ケース（eval/cases/<id>.json）がある
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const PUZZLE_DIR = path.join("data", "puzzles");
const CASE_DIR = path.join("eval", "cases");

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isNonEmptyStringArray = (v: unknown) => Array.isArray(v) && v.length > 0 && v.every(isNonEmptyString);

const errors: string[] = [];
const files = readdirSync(PUZZLE_DIR).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const where = path.join(PUZZLE_DIR, file);
  let puzzle: Record<string, unknown>;
  try {
    puzzle = JSON.parse(readFileSync(where, "utf8"));
  } catch (e) {
    errors.push(`${where}: JSON として読めません（${(e as Error).message}）`);
    continue;
  }

  for (const key of ["id", "title", "problem", "truth"]) {
    if (!isNonEmptyString(puzzle[key])) errors.push(`${where}: ${key} は空でない文字列にしてください`);
  }
  for (const key of ["facts", "keyPoints"]) {
    if (!isNonEmptyStringArray(puzzle[key])) errors.push(`${where}: ${key} は空でない文字列の配列にしてください`);
  }

  const expectedId = path.basename(file, ".json");
  if (puzzle.id !== expectedId) errors.push(`${where}: id（${String(puzzle.id)}）をファイル名（${expectedId}）と一致させてください`);
  if (!existsSync(path.join(CASE_DIR, file))) errors.push(`${where}: 評価ケース ${path.join(CASE_DIR, file)} がありません`);
}

if (files.length === 0) errors.push(`${PUZZLE_DIR} に問題がありません`);

if (errors.length > 0) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ ${files.length} 問の問題データを確認しました`);
