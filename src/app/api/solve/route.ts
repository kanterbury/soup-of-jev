import { createJevClient } from "@/lib/jev/client";
import { judgeSolution } from "@/lib/judge";
import { getPuzzle } from "@/lib/puzzles";

export const runtime = "nodejs";

const MAX_ANSWER_LENGTH = 500;

export async function POST(request: Request) {
  const { puzzleId, answer } = (await request.json().catch(() => ({}))) as {
    puzzleId?: string;
    answer?: string;
  };
  if (typeof answer !== "string" || !answer.trim() || answer.length > MAX_ANSWER_LENGTH) {
    return Response.json({ error: `answer は 1〜${MAX_ANSWER_LENGTH} 文字で指定してください` }, { status: 400 });
  }
  const puzzle = typeof puzzleId === "string" ? getPuzzle(puzzleId) : undefined;
  if (!puzzle) return Response.json({ error: "puzzle が見つかりません" }, { status: 404 });

  const { solved, matched, total } = await judgeSolution(createJevClient(), puzzle, answer.trim());
  return Response.json({ solved, matched, total, truth: solved ? puzzle.truth : undefined });
}
