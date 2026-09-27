"use client";

import { useLikeCounts } from "@/lib/likeCounts";
import { type PuzzleSort, setListSort, useListSort } from "@/lib/progress";
import type { PublicPuzzle } from "@/lib/puzzles";
import { sortPuzzles } from "@/lib/sortPuzzles";
import { PuzzleCardStatus } from "./PuzzleCardStatus";

const SORTS: { value: PuzzleSort; label: string }[] = [
  { value: "newest", label: "新しい順" },
  { value: "likes", label: "いいねの多い順" },
];

/**
 * 問題の一覧と並び順の切り替え（設計書 D9）。並び順といいねの数はブラウザにあるので、クライアントで並べる。
 * 受け取るのは PublicPuzzle だけ（真相は含まない）。
 */
export function PuzzleList({ puzzles }: { puzzles: PublicPuzzle[] }) {
  const sort = useListSort();
  const sorted = sortPuzzles(puzzles, sort, useLikeCounts());

  return (
    <>
      <div role="group" aria-label="並び順" className="flex justify-center">
        {SORTS.map(({ value, label }) => {
          const selected = value === sort;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => setListSort(value)}
              className={`-ml-px inline-flex h-9 items-center border px-4 text-[13px] tracking-[0.06em] first:ml-0 ${
                selected
                  ? "relative border-gold bg-gold font-bold text-(--color-shadow)"
                  : "cursor-pointer border-gold/60 font-medium text-gold hover:bg-gold/10"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {sorted.map((puzzle) => (
          <article
            key={puzzle.id}
            className="frame-double flex flex-col gap-4 bg-[rgb(42_7_16/0.55)] px-6 pt-[30px] pb-[26px] sm:px-7"
          >
            <PuzzleCardStatus puzzleId={puzzle.id} number={puzzle.number}>
              <h2 className="m-0 font-display text-[22px] leading-[1.35] font-extrabold text-ivory sm:text-[26px]">
                {puzzle.title}
              </h2>
              <p className="m-0 line-clamp-4 text-[14.5px] leading-[1.85] text-rose">
                {puzzle.problem}
              </p>
            </PuzzleCardStatus>
          </article>
        ))}
      </div>
    </>
  );
}
