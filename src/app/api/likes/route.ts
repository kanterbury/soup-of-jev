import { badRequest, errorResponse, findPuzzle, puzzleNotFound, readJson } from "@/lib/api";
import { getLikeStore } from "@/lib/likes";
import { listPublicPuzzles } from "@/lib/puzzles";

export const runtime = "nodejs";
// 数は押されるたびに変わるので、ビルド時に固めない
export const dynamic = "force-dynamic";

const SAVE_FAILED = "いいねの保存に失敗しました";

/** 全問題のいいねの数（設計書 D8） */
export async function GET() {
  try {
    const counts = await getLikeStore().counts(listPublicPuzzles().map((p) => p.id));
    return Response.json({ counts }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e, "いいねの数を読めませんでした");
  }
}

/** いいねを押す（liked: true）か取り消す（liked: false）。押したかどうかはブラウザで覚える */
export async function POST(request: Request) {
  try {
    const { puzzleId, liked } = await readJson(request);
    const puzzle = findPuzzle(puzzleId);
    if (!puzzle) return puzzleNotFound();
    if (typeof liked !== "boolean") return badRequest("liked は true か false にしてください");
    const count = await getLikeStore().add(puzzle.id, liked ? 1 : -1);
    return Response.json({ count });
  } catch (e) {
    return errorResponse(e, SAVE_FAILED);
  }
}
