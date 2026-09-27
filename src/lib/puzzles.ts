import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** サーバー側だけで扱う完全な問題データ。truth / facts / keyPoints はクライアントに渡さない。 */
export type Puzzle = {
  id: string;
  /** 一覧に出す固定の番号（No.）。追加した順に振る */
  number: number;
  title: string;
  /** プレイヤーに見せる問題文 */
  problem: string;
  /** 非公開の真相（物語） */
  truth: string;
  /** 真相から推論の段数を減らすための明示的な事実リスト */
  facts: string[];
  /** 正解判定に使う、真相の要点 */
  keyPoints: string[];
};

/** クライアントに返してよい項目だけ */
export type PublicPuzzle = Pick<Puzzle, "id" | "number" | "title" | "problem">;

const PUZZLE_DIR = path.join(process.cwd(), "data", "puzzles");

let cache: Map<string, Puzzle> | undefined;

function loadAll(): Map<string, Puzzle> {
  if (cache) return cache;
  cache = new Map();
  for (const file of readdirSync(PUZZLE_DIR).filter((f) =>
    f.endsWith(".json"),
  )) {
    const puzzle = JSON.parse(
      readFileSync(path.join(PUZZLE_DIR, file), "utf8"),
    ) as Puzzle;
    cache.set(puzzle.id, puzzle);
  }
  return cache;
}

export function getPuzzle(id: string): Puzzle | undefined {
  return loadAll().get(id);
}

export function listPublicPuzzles(): PublicPuzzle[] {
  return [...loadAll().values()]
    .sort((a, b) => a.number - b.number)
    .map(toPublic);
}

export function toPublic({ id, number, title, problem }: Puzzle): PublicPuzzle {
  return { id, number, title, problem };
}
