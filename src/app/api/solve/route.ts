import {
  badRequest,
  errorResponse,
  findPuzzle,
  puzzleNotFound,
  readJson,
  readText,
} from "@/lib/api";
import { createJevClient } from "@/lib/jev/client";
import { judgeSolution } from "@/lib/judge";

export const runtime = "nodejs";

const MAX_ANSWER_LENGTH = 500;

export async function POST(request: Request) {
  const { puzzleId, answer: rawAnswer } = await readJson(request);
  const answer = readText(rawAnswer, MAX_ANSWER_LENGTH);
  if (!answer)
    return badRequest(
      `answer は 1〜${MAX_ANSWER_LENGTH} 文字で指定してください`,
    );
  const puzzle = findPuzzle(puzzleId);
  if (!puzzle) return puzzleNotFound();

  try {
    const { solved, matched, total } = await judgeSolution(
      createJevClient(),
      puzzle,
      answer,
    );
    // 真相は正解したときだけ返す。要点の中身は返さない
    return Response.json(
      solved
        ? { solved, matched, total, truth: puzzle.truth }
        : { solved, matched, total },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
