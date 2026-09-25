# AGENTS.md

水平思考クイズ（ウミガメのスープ）のプレイヤーの質問を、TypeSafe AI の Jev で「YES / NO / どちらともいえない」に判定する Web アプリ。
設計書（`docs/app-design.md`）のフェーズ 1〜4（サーバー側、画面、公開前評価、Vercel への公開）まで完了している。

## 公開を前提に書く

このリポジトリは今は private だが、**今後 public にする想定**。コミットするものはすべて、誰でも読める前提で書く。

- **秘密情報はリポジトリの外に置く**：API キーは `.env.local`（git の管理対象外）だけに書く。新しい設定値を足すときは、値を空にした見本を `.env.local.example` に加える。
- **問題データは自作か、出典と利用条件を確かめたものにする**：`data/puzzles/` の問題文・真相は、公開しても問題ない文章にする。有名な問題も、文章は自分の言葉で書き直す。
- **ドキュメントは外部の読者にも通じるように書く**：個人名・社内事情・個人の環境に依存するパスは書かない。claude.ai のアーティファクトなど非公開のリンクを載せるときは、同じ内容をリポジトリ内にも置く（例：`docs/design/mockups/`）。
- **評価結果の生データ**（`eval/results/`）はコミットしない。要約は `research/poc-results.md` に書く。

## まず読むもの

- **設計の判断**：`docs/app-design.md`。§1「決定の記録」が、これまでに決めたことの一覧。実装や変更の前に読み、決定と食い違う変更をするときは、先に §1 を更新する。
- **見た目**：`docs/app-design.md` §6.4 が仕様（配色・書体・判定の表示）。細部は `docs/design/mockups/`。
- **Jev の性質と PoC の結果**：`research/what-is-jev.md`、`research/poc-results.md`。

## 問題を増やすとき

`.claude/skills/add-puzzles/`（スキル `add-puzzles`）の手順に従う：問題と評価ケースを書き、ユーザーに期待値をレビューしてもらい、holdout として一度だけ評価して記録する。

## 判定まわりを変えるとき

- **真相はサーバーの中だけで扱う**：`truth`・`facts`・`keyPoints` を含む `Puzzle` はサーバー側で使い、クライアントには `toPublic()` を通した `PublicPuzzle` だけを渡す。`/api/ask` の応答は `verdict` だけにする（確信度も返さない。設計書 R2）。
- **Jev は問いの文言を字義通りに読む**：`src/lib/judge.ts` の問いの文言・選択肢・閾値を変えたら、`npm run eval -- --all` で評価し直し、結果を `research/poc-results.md` に追記する。評価は実際に Jev を呼ぶので、`.env.local` の API キーと、わずかな費用がかかる。
- **閾値は凍結してから評価する**：公開前評価では、調整用のデータで閾値を決めて凍結し、確認用のデータ（holdout）は一度だけ評価する（設計書 §7.2）。確認用の結果を見て閾値を直したら、新しい確認用データを用意する。

## 決まりごと

- **言語**：ドキュメント・コメント・コミットメッセージは日本語。コード上の識別子は英語。
- **ブランチ**：既定のブランチは `master`。新しいブランチ名は半角英数字とハイフン・スラッシュ・アンダースコアで付ける（例：`feature/play-screen`）。
- **TypeScript 7**：`types` の既定値が変わったため、`tsconfig.json` で `"types": ["node"]` を明示している。外すと Node の型が見つからなくなる。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
