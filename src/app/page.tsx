import { listPublicPuzzles } from "@/lib/puzzles";

// PoC 段階の確認用ページ。チャット UI は PoC の結果を見てから作る。
export default function Home() {
  const puzzles = listPublicPuzzles();
  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <h1>Soup of Jev（PoC）</h1>
      <p>
        判定 API: <code>POST /api/ask</code> {"{ puzzleId, question }"} ／ 正解判定: <code>POST /api/solve</code>{" "}
        {"{ puzzleId, answer }"}
      </p>
      {puzzles.map((p) => (
        <section key={p.id}>
          <h2>
            {p.title} <small>({p.id})</small>
          </h2>
          <p>{p.problem}</p>
        </section>
      ))}
    </main>
  );
}
