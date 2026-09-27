import { useSyncExternalStore } from "react";
import { setLiked } from "./progress";

/**
 * いいねの数をブラウザで持つ（設計書 D8）。
 * 画面が開かれるたびに GET /api/likes で取り直し、押したときは先に数を変えてから保存する。
 */
type Counts = Record<string, number>;

/** undefined は読み込み中、null は取れなかった */
let counts: Counts | null | undefined;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function load() {
  loading ??= fetch("/api/likes", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`GET /api/likes ${res.status}`);
      counts = ((await res.json()) as { counts: Counts }).counts;
    })
    .catch(() => {
      // 前に取れた数があれば、それを出し続ける
      counts ??= null;
    })
    .finally(() => {
      loading = undefined;
      notify();
    });
}

function subscribe(onChange: () => void) {
  // 使う画面が開かれたときに取り直す
  if (listeners.size === 0) load();
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function setCount(puzzleId: string, count: number) {
  counts = { ...counts, [puzzleId]: count };
  notify();
}

/** 全問題のいいねの数。読み込み中は undefined、取れなかったら null */
export function useLikeCounts(): Counts | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => counts,
    () => undefined,
  );
}

/**
 * いいねを押す（liked: true）か取り消す。表示を先に変え、保存に失敗したら元に戻す。
 * 失敗したときはエラーの文言を返す。
 */
export async function toggleLike(
  puzzleId: string,
  liked: boolean,
): Promise<string | undefined> {
  const before = counts?.[puzzleId];
  setLiked(puzzleId, liked);
  if (before !== undefined)
    setCount(puzzleId, Math.max(0, before + (liked ? 1 : -1)));
  try {
    const res = await fetch("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ puzzleId, liked }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(
        typeof json.error === "string"
          ? json.error
          : "いいねの保存に失敗しました",
      );
    setCount(puzzleId, json.count);
    return undefined;
  } catch (e) {
    setLiked(puzzleId, !liked);
    if (before !== undefined) setCount(puzzleId, before);
    return e instanceof TypeError
      ? "通信に失敗しました。もう一度押してください"
      : (e as Error).message;
  }
}
