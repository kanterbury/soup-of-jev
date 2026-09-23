"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "@/components/Ornaments";
import { useProgress } from "@/lib/progress";

/**
 * 問題カードの進行状況とボタン。進行状況は localStorage にあるので、この部分だけクライアントで描く。
 * 状態の表示は判定ではないので、囲みを残す（設計書 §6.4）。
 */
export function PuzzleCardStatus({
  puzzleId,
  number,
  children,
}: {
  puzzleId: string;
  number: number;
  children: ReactNode;
}) {
  const progress = useProgress(puzzleId);
  const href = `/puzzles/${puzzleId}`;

  let badge: ReactNode = null;
  let action: ReactNode;
  if (progress === undefined) {
    // 読み込む前は、ボタンの場所だけ確保しておく
    action = <span className="btn-secondary invisible">この謎に挑む</span>;
  } else if (!progress) {
    badge = (
      <span className="inline-flex h-[26px] items-center border border-dashed border-[#a88b87] px-2.5 text-xs font-medium tracking-[0.06em] text-rose-muted">
        未挑戦
      </span>
    );
    action = <Link href={href} className="btn-primary">この謎に挑む</Link>;
  } else if (progress.status === "playing") {
    badge = (
      <span className="inline-flex h-[26px] items-center border border-gold/70 px-2.5 text-xs font-bold tracking-[0.06em] text-gold">
        挑戦中・質問 {progress.log.length}
      </span>
    );
    action = <Link href={href} className="btn-primary">続きから</Link>;
  } else {
    badge =
      progress.status === "solved" ? (
        <span className="inline-flex h-[26px] items-center gap-1.5 bg-gold px-2.5 text-xs font-bold tracking-[0.06em] text-(--color-shadow)">
          <Check className="size-3" />
          正解済み
        </span>
      ) : (
        <span className="inline-flex h-[26px] items-center border border-rose-muted/60 px-2.5 text-xs font-medium tracking-[0.06em] text-rose-muted">
          真相を確認済み
        </span>
      );
    action = <Link href={href} className="btn-secondary">真相をもう一度見る</Link>;
  }

  return (
    <>
      <div className="flex min-h-[26px] items-center justify-between gap-3">
        <span className="font-label text-[13px] font-semibold tracking-[0.24em] text-gold-muted">No. {number}</span>
        {badge}
      </div>
      {children}
      <div className="mt-auto flex flex-col">{action}</div>
    </>
  );
}
