import {
  badRequest,
  errorResponse,
  findPuzzle,
  puzzleNotFound,
  readJson,
} from "@/lib/api";

export const runtime = "nodejs";

/** ヒントを 1 つ返す。誰でも呼べ、順番も確かめない（守るのはうっかりネタバレだけ。設計書 §5.3、D11） */
export async function POST(request: Request) {
  try {
    const { puzzleId, index } = await readJson(request);
    const puzzle = findPuzzle(puzzleId);
    if (!puzzle) return puzzleNotFound();
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= puzzle.hints.length
    )
      return badRequest(
        `index は 0 以上 ${puzzle.hints.length - 1} 以下の整数にしてください`,
      );
    return Response.json({ hint: puzzle.hints[index] });
  } catch (e) {
    return errorResponse(e);
  }
}
