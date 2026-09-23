import Link from "next/link";
import { GoldDivider, Logo } from "@/components/Ornaments";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      <Logo size="lg" />
      <GoldDivider width={280} />
      <h1 className="m-0 font-display text-2xl font-extrabold text-ivory">この謎は見つかりません</h1>
      <p className="m-0 text-sm text-rose">URL が間違っているか、問題が取り下げられた可能性があります。</p>
      <Link href="/" className="btn-primary mt-2">
        問題一覧へ
      </Link>
    </main>
  );
}
