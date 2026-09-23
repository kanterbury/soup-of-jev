import type { Verdict } from "@/lib/judge";

/**
 * 判定の表示（設計書 §6.4）。ボタンに見えないよう、枠・塗り・背景を付けず文字だけで出す。
 * YES / NO は最小幅をそろえ、縦に並んだときに位置がそろうようにする。
 */
export function VerdictLabel({ verdict }: { verdict: Verdict }) {
  switch (verdict) {
    case "yes":
    case "no":
      return (
        <span
          className={`inline-flex h-7 min-w-14 shrink-0 items-center justify-center font-label text-[15px] font-bold tracking-[0.16em] sm:h-8 sm:min-w-[76px] sm:text-lg sm:tracking-[0.2em] ${
            verdict === "yes" ? "text-gold" : "text-ivory"
          }`}
        >
          {verdict === "yes" ? "YES" : "NO"}
        </span>
      );
    case "unknown":
      return (
        <span className="inline-flex h-7 shrink-0 items-center text-[12.5px] font-medium tracking-[0.04em] text-rose sm:h-8 sm:text-sm">
          どちらともいえない
        </span>
      );
    case "invalid":
      return (
        <span className="inline-flex h-7 shrink-0 items-center gap-1 text-[11.5px] text-dim sm:h-8 sm:gap-1.5 sm:text-[13px]">
          <svg
            aria-hidden="true"
            className="size-3 sm:size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <polyline points="3 3 3 9 9 9" />
          </svg>
          言い直してください
        </span>
      );
  }
}
