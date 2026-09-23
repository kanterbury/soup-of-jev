import { GoldDivider, Logo, PrivacyNote } from "@/components/Ornaments";
import { listPublicPuzzles } from "@/lib/puzzles";
import { PuzzleCardStatus } from "./PuzzleCardStatus";

export default function Home() {
  const puzzles = listPublicPuzzles();
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1280px] flex-col items-center gap-8 px-4 pt-10 pb-8 sm:gap-10 sm:px-10 sm:pt-12 lg:px-20">
      <header className="flex flex-col items-center gap-3.5">
        <Logo size="lg" />
        <GoldDivider />
        <div className="text-[15px] tracking-[0.3em] text-rose-muted">水平思考クイズ</div>
      </header>

      <main className="flex w-full flex-col gap-6">
        <h1 className="m-0 text-center font-display text-[22px] font-extrabold text-ivory sm:text-[26px]">問題を選ぶ</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {puzzles.map((puzzle, i) => (
            <article key={puzzle.id} className="frame-double flex flex-col gap-4 bg-[rgb(42_7_16/0.55)] px-6 pt-[30px] pb-[26px] sm:px-7">
              <PuzzleCardStatus puzzleId={puzzle.id} number={i + 1}>
                <h2 className="m-0 font-display text-[22px] leading-[1.35] font-extrabold text-ivory sm:text-[26px]">{puzzle.title}</h2>
                <p className="m-0 line-clamp-4 text-[14.5px] leading-[1.85] text-rose">{puzzle.problem}</p>
              </PuzzleCardStatus>
            </article>
          ))}
        </div>
      </main>

      <footer className="mt-auto text-center">
        <PrivacyNote />
      </footer>
    </div>
  );
}
