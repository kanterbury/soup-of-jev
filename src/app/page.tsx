import { GitHubMark, GoldDivider, Logo, PrivacyNote } from "@/components/Ornaments";
import { listPublicPuzzles } from "@/lib/puzzles";
import { PuzzleList } from "./PuzzleList";

const REPOSITORY_URL = "https://github.com/kanterbury/soup-of-jev";

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

      <footer className="mt-auto flex flex-col items-center gap-1 text-center">
        <PrivacyNote />
        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub でソースを見る"
          title="GitHub でソースを見る"
          className="inline-flex size-11 items-center justify-center text-white hover:text-white"
        >
          <GitHubMark className="size-5" />
        </a>
      </footer>
    </div>
  );
}
