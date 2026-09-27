import { describe, expect, it } from "vitest";
import type { PublicPuzzle } from "./puzzles";
import { sortPuzzles } from "./sortPuzzles";

const puzzle = (id: string, number: number): PublicPuzzle => ({
  id,
  number,
  title: id,
  problem: "",
});
const puzzles = [puzzle("a", 1), puzzle("b", 2), puzzle("c", 3)];
const ids = (list: PublicPuzzle[]) => list.map((p) => p.id);

describe("sortPuzzles", () => {
  it("新しい順は number の降順", () => {
    expect(ids(sortPuzzles(puzzles, "newest", { a: 5 }))).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("いいねの多い順。同数と、数のない問題は新しい順", () => {
    expect(ids(sortPuzzles(puzzles, "likes", { a: 3, b: 1 }))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(ids(sortPuzzles(puzzles, "likes", { a: 2, b: 2 }))).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("いいねの数が取れていないときは新しい順", () => {
    expect(ids(sortPuzzles(puzzles, "likes", undefined))).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(ids(sortPuzzles(puzzles, "likes", null))).toEqual(["c", "b", "a"]);
  });

  it("入力の配列は変えない", () => {
    sortPuzzles(puzzles, "newest", undefined);
    expect(ids(puzzles)).toEqual(["a", "b", "c"]);
  });
});
