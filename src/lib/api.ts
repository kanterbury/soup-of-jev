import { JevUnavailableError } from "./jev/client";
import { getPuzzle, type Puzzle } from "./puzzles";

/** 本文を JSON として読む。読めなければ空のオブジェクトにする（入力チェックで 400 になる） */
export async function readJson(
  request: Request,
): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => ({}));
  return body !== null && typeof body === "object"
    ? (body as Record<string, unknown>)
    : {};
}

/** trim() した後の長さで 1〜maxLength 文字か確かめる。だめなら undefined */
export function readText(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text && text.length <= maxLength ? text : undefined;
}

export function findPuzzle(puzzleId: unknown): Puzzle | undefined {
  return typeof puzzleId === "string" ? getPuzzle(puzzleId) : undefined;
}

export const badRequest = (error: string) =>
  Response.json({ error }, { status: 400 });
export const puzzleNotFound = () =>
  Response.json({ error: "puzzle が見つかりません" }, { status: 404 });

/**
 * Jev の呼び出しなどで起きた失敗を応答にする（設計書 R6）。
 * 時間をおけば直りうる失敗は 503、それ以外は 500。原因はサーバーログにだけ残す。
 * message は 500 のときの文言（いいねの API などで変える）。
 */
export function errorResponse(
  e: unknown,
  message = "判定に失敗しました",
): Response {
  if (e instanceof JevUnavailableError) {
    console.warn(e);
    return Response.json(
      { error: "混み合っています。少し待ってからもう一度送ってください" },
      { status: 503 },
    );
  }
  console.error(e);
  return Response.json({ error: message }, { status: 500 });
}
