import { sendGAEvent } from "@next/third-parties/google";
import type { Verdict } from "./judge";

/**
 * アクセス解析（Google Analytics 4。設計書 D10）。
 * 送るのは問題 ID・判定・数だけで、質問文・回答文は送らない（Q5）。自由入力の文字列が紛れ込まないよう、引数を型で縛る。
 */
export type AnalyticsEvent =
  | { name: "ask"; params: { puzzle_id: string; verdict: Verdict; question_number: number } }
  | { name: "solve_attempt"; params: { puzzle_id: string; solved: boolean; matched: number; total: number; question_count: number } }
  | { name: "puzzle_solved"; params: { puzzle_id: string; question_count: number; attempt_count: number } }
  | { name: "reveal"; params: { puzzle_id: string; question_count: number } }
  | { name: "restart"; params: { puzzle_id: string } }
  | { name: "like"; params: { puzzle_id: string; liked: boolean } };

/** 測定 ID。空なら GA を読み込まず、計測もしない（開発・Preview） */
export function gaMeasurementId(): string | undefined {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || undefined;
}

export function track({ name, params }: AnalyticsEvent): void {
  if (!gaMeasurementId()) return;
  sendGAEvent("event", name, params);
}
