"use client";

import { useState } from "react";
import { toggleLike, useLikeCounts } from "@/lib/likeCounts";
import { useLiked } from "@/lib/progress";
import { Heart } from "./Ornaments";

/** 真相の表示に置くいいねボタン（設計書 D8）。今の数を一緒に出し、もう一度押すと取り消せる */
export function LikeButton({ puzzleId }: { puzzleId: string }) {
  const liked = useLiked(puzzleId);
  const count = useLikeCounts()?.[puzzleId];
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  async function onClick() {
    if (sending || liked === undefined) return;
    setSending(true);
    setError(undefined);
    setError(await toggleLike(puzzleId, !liked));
    setSending(false);
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        className={`btn-secondary min-h-12 gap-2 px-[22px] ${liked ? "border-gold bg-gold/15" : ""}`}
        aria-pressed={liked ?? false}
        disabled={sending}
        onClick={onClick}
      >
        <Heart className="size-[18px]" filled={liked} />
        {liked ? "いいね済み" : "いいね"}
        {count !== undefined && <span className="font-label text-base font-semibold text-ivory">{count}</span>}
      </button>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-rose">
          {error}
        </p>
      )}
    </div>
  );
}
