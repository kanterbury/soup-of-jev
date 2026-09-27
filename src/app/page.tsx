import { GoldDivider, Logo, PrivacyNote } from "@/components/Ornaments";
import { listPublicPuzzles } from "@/lib/puzzles";
import { PuzzleList } from "./PuzzleList";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1280px] flex-col items-center gap-8 px-4 pt-10 pb-8 sm:gap-10 sm:px-10 sm:pt-12 lg:px-20">
      <header className="flex flex-col items-center gap-3.5">
        <Logo size="lg" />
        <GoldDivider />
        <div className="text-[15px] tracking-[0.3em] text-rose-muted">水平思考クイズ</div>
      </header>

      <main className="flex w-full flex-col gap-6">
        <h1 className="m-0 text-center font-display text-[22px] font-extrabold text-ivory sm:text-[26px]">問題を選ぶ</h1>
        <PuzzleList puzzles={listPublicPuzzles()} />
      </main>

      <footer className="mt-auto text-center">
        <PrivacyNote />
      </footer>
    </div>
  );
}
