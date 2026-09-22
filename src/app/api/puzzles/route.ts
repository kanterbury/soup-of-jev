import { listPublicPuzzles } from "@/lib/puzzles";

export const runtime = "nodejs";

export function GET() {
  return Response.json(listPublicPuzzles());
}
