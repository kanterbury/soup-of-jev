import type { PuzzleSort } from "./progress";
import type { PublicPuzzle } from "./puzzles";

/**
 * 問題一覧を並べ替える（設計書 D9）。入力の配列は変えない。
 * - newest：新しい順（number の降順）
 * - likes：いいねの多い順。同数は新しい順。数が取れていないときは新しい順と同じ
 */
export function sortPuzzles(
  puzzles: PublicPuzzle[],
  sort: PuzzleSort,
  likes: Record<string, number> | null | undefined,
): PublicPuzzle[] {
  const newest = (a: PublicPuzzle, b: PublicPuzzle) => b.number - a.number;
  if (sort === "likes" && likes) {
    const count = (p: PublicPuzzle) => likes[p.id] ?? 0;
    return [...puzzles].sort((a, b) => count(b) - count(a) || newest(a, b));
  }
  return [...puzzles].sort(newest);
}
