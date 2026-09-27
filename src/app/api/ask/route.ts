import {
  badRequest,
  errorResponse,
  findPuzzle,
  puzzleNotFound,
  readJson,
  readText,
} from "@/lib/api";
import { createJevClient } from "@/lib/jev/client";
import { judgeQuestion } from "@/lib/judge";

export const runtime = "nodejs";

const MAX_QUESTION_LENGTH = 200;

export async function POST(request: Request) {
  const { puzzleId, question: rawQuestion } = await readJson(request);
  const question = readText(rawQuestion, MAX_QUESTION_LENGTH);
  if (!question)
    return badRequest(
      `question は 1〜${MAX_QUESTION_LENGTH} 文字で指定してください`,
    );
  const puzzle = findPuzzle(puzzleId);
  if (!puzzle) return puzzleNotFound();

  try {
    const { verdict } = await judgeQuestion(
      createJevClient(),
      puzzle,
      question,
    );
    // 確信度や内部の判定（irrelevant / uncertain）はヒントになるので返さない（設計書 R2）
    return Response.json({ verdict });
  } catch (e) {
    return errorResponse(e);
  }
}
