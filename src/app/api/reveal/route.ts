import { errorResponse, findPuzzle, puzzleNotFound, readJson } from "@/lib/api";

export const runtime = "nodejs";

/** 「真相を見る」で、解かずに真相を見る。誰でも呼べる（守るのはうっかりネタバレだけ。設計書 §5.3） */
export async function POST(request: Request) {
  try {
    const { puzzleId } = await readJson(request);
    const puzzle = findPuzzle(puzzleId);
    if (!puzzle) return puzzleNotFound();
    return Response.json({ truth: puzzle.truth });
  } catch (e) {
    return errorResponse(e);
  }
}
