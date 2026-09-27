import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPuzzle, toPublic } from "@/lib/puzzles";
import { PlayView } from "./PlayView";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const puzzle = getPuzzle((await params).id);
  return { title: puzzle?.title ?? "問題が見つかりません" };
}

export default async function PuzzlePage({ params }: Props) {
  const { id } = await params;
  const puzzle = getPuzzle(id);
  if (!puzzle) notFound();

  // クライアントコンポーネントには、真相を含まない PublicPuzzle だけを渡す（設計書 §5.3）
  return <PlayView puzzle={toPublic(puzzle)} number={puzzle.number} />;
}
