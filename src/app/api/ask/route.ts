import { createJevClient } from "@/lib/jev/client";
import { judgeQuestion } from "@/lib/judge";
import { getPuzzle } from "@/lib/puzzles";

export const runtime = "nodejs";

const MAX_QUESTION_LENGTH = 200;

export async function POST(request: Request) {
  const { puzzleId, question } = (await request.json().catch(() => ({}))) as {
    puzzleId?: string;
    question?: string;
  };
  if (typeof question !== "string" || !question.trim() || question.length > MAX_QUESTION_LENGTH) {
    return Response.json({ error: `question は 1〜${MAX_QUESTION_LENGTH} 文字で指定してください` }, { status: 400 });
  }
  const puzzle = typeof puzzleId === "string" ? getPuzzle(puzzleId) : undefined;
  if (!puzzle) return Response.json({ error: "puzzle が見つかりません" }, { status: 404 });

  const judgement = await judgeQuestion(createJevClient(), puzzle, question.trim());
  // 真相に関わる情報（確率分布など）は返さず、判定結果だけを返す
  return Response.json({
    verdict: judgement.verdict,
    confidence: judgement.confidence,
  });
}
