import type { ReactNode } from "react";
import { GoldDivider } from "./Ornaments";

const corner = "absolute size-3 rotate-45 bg-gold";

/**
 * 真相の表示（設計書 §6.4、モックアップ Reveal）。
 * 二重枠の四隅に金のひし形を置く。正解したときは金の丸い印と SOLVED を出す。
 */
export function TruthCard({
  title,
  truth,
  solved,
  children,
}: {
  title: string;
  truth: string;
  solved: boolean;
  children?: ReactNode;
}) {
  return (
    <article className="relative mx-auto flex w-full max-w-[760px] flex-col items-center gap-6 border border-gold bg-[rgb(36_6_13/0.72)] px-6 pt-10 pb-8 shadow-[inset_0_0_0_7px_rgb(36_6_13/0.72),inset_0_0_0_8px_rgb(212_178_106/0.55),0_40px_80px_rgb(10_0_3/0.7)] sm:px-[72px] sm:pt-16 sm:pb-[52px]">
      <span aria-hidden="true" className={`${corner} -top-[7px] -left-[7px]`} />
      <span
        aria-hidden="true"
        className={`${corner} -top-[7px] -right-[7px]`}
      />
      <span
        aria-hidden="true"
        className={`${corner} -bottom-[7px] -left-[7px]`}
      />
      <span
        aria-hidden="true"
        className={`${corner} -right-[7px] -bottom-[7px]`}
      />

      {solved && (
        <svg
          aria-hidden="true"
          className="size-20 sm:size-24"
          viewBox="0 0 96 96"
        >
          <circle
            cx="48"
            cy="48"
            r="46"
            fill="none"
            stroke="#d4b26a"
            strokeWidth="1"
          />
          <circle cx="48" cy="48" r="40" fill="#d4b26a" />
          <circle
            cx="48"
            cy="48"
            r="35"
            fill="none"
            stroke="#2a0710"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
          <polyline
            points="33 49 44 60 64 37"
            fill="none"
            stroke="#2a0710"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      <div className="flex flex-col items-center gap-2 text-center">
        <div className="font-label text-sm font-semibold tracking-[0.4em] text-gold">
          {solved ? "SOLVED" : "THE TRUTH"}
        </div>
        <h2 className="m-0 font-display text-2xl font-extrabold text-ivory sm:text-[34px]">
          {title} — 真相
        </h2>
      </div>

      <GoldDivider width={280} />

      <p className="m-0 font-display text-base leading-[2.05] font-semibold text-pretty text-ivory sm:text-lg">
        {truth}
      </p>

      {children && (
        <div className="flex flex-wrap justify-center gap-3.5 pt-2">
          {children}
        </div>
      )}
    </article>
  );
}
