import { useSyncExternalStore } from "react";
import type { Verdict } from "./judge";

/**
 * 問題ごとの進行状況（設計書 §6.2）。ブラウザの localStorage に置く。
 * 保存できない環境（シークレットウィンドウなど）でも遊べるよう、読み書きはすべて try/catch で包む。
 */
export type Progress = {
  log: { question: string; verdict: Verdict }[];
  status: "playing" | "solved" | "gave-up";
  /** 正解したときか「真相を見る」で表示したときに保存する */
  truth?: string;
};

// 問題データを変えたときに古い記録を捨てられるよう、キーにバージョンを入れる
const PREFIX = "soup-of-jev:v1:";
const progressKey = (puzzleId: string) => `${PREFIX}progress:${puzzleId}`;
const HOWTO_KEY = `${PREFIX}seen-howto`;
// いいねを押したか（設計書 D8）。やり直し（clearProgress）では消さない
const likedKey = (puzzleId: string) => `${PREFIX}liked:${puzzleId}`;
// 問題一覧の並び順（設計書 D9）
const SORT_KEY = `${PREFIX}list-sort`;

/** 問題一覧の並び順。newest は新しい順（number の降順）、likes はいいねの多い順 */
export type PuzzleSort = "newest" | "likes";

/** 同じタブでの書き込みを購読者に知らせるイベント（storage イベントは別のタブでしか発火しない） */
const CHANGE_EVENT = "soup-of-jev:progress-change";

/** localStorage が使えないときの控え。ページを開いている間だけ残る */
const memory = new Map<string, string>();
/** 書き込みに失敗したら、以後は控えを正とする（読めても書けない環境があるため） */
let storageBroken = false;

function read(key: string): string | null {
  if (storageBroken) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    storageBroken = true;
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string | null) {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // 保存できなくても、控えを使ってこの画面の中では遊べる
    storageBroken = true;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function parseProgress(raw: string | null): Progress | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Progress;
    return Array.isArray(value.log) && typeof value.status === "string" ? value : null;
  } catch {
    return null;
  }
}

export function loadProgress(puzzleId: string): Progress | null {
  return parseProgress(read(progressKey(puzzleId)));
}

export function saveProgress(puzzleId: string, progress: Progress) {
  write(progressKey(puzzleId), JSON.stringify(progress));
}

export function clearProgress(puzzleId: string) {
  write(progressKey(puzzleId), null);
}

export function markHowtoSeen() {
  write(HOWTO_KEY, "1");
}

export function setLiked(puzzleId: string, liked: boolean) {
  write(likedKey(puzzleId), liked ? "1" : null);
}

export function setListSort(sort: PuzzleSort) {
  write(SORT_KEY, sort);
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// getSnapshot は同じ内容なら同じ参照を返す必要があるので、生の文字列ごとに解析結果を覚えておく
const parsed = new Map<string, { raw: string | null; value: Progress | null }>();

function snapshotOf(puzzleId: string): Progress | null {
  const raw = read(progressKey(puzzleId));
  const cached = parsed.get(puzzleId);
  if (cached && cached.raw === raw) return cached.value;
  const value = parseProgress(raw);
  parsed.set(puzzleId, { raw, value });
  return value;
}

/**
 * 進行状況を読む。サーバーでの描画と、ブラウザでの最初の描画（hydration）では undefined を返し、
 * その後 localStorage の値（記録がなければ null）に切り替わる。
 */
export function useProgress(puzzleId: string): Progress | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => snapshotOf(puzzleId),
    () => undefined,
  );
}

/** 遊び方を表示済みか。サーバーでの描画中は true（表示しない）として扱う */
export function useHowtoSeen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => read(HOWTO_KEY) !== null,
    () => true,
  );
}

/** いいねを押したか。サーバーでの描画中は undefined */
export function useLiked(puzzleId: string): boolean | undefined {
  return useSyncExternalStore(
    subscribe,
    () => read(likedKey(puzzleId)) !== null,
    () => undefined,
  );
}

/** 問題一覧の並び順。サーバーでの描画中と、記録がないか読めないときは新しい順 */
export function useListSort(): PuzzleSort {
  return useSyncExternalStore(
    subscribe,
    () => (read(SORT_KEY) === "likes" ? "likes" : "newest"),
    () => "newest",
  );
}
