# Soup of Jev

水平思考クイズ（ウミガメのスープ）をひとりで遊べる Web アプリ。
プレイヤーの質問を、TypeSafe AI の Jev が「YES / NO / どちらともいえない」で判定する。

- 公開先：https://soup-of-jev.vercel.app/
- 設計：`docs/app-design.md`（§1 が決定の記録）
- Jev の調査と PoC の結果：`research/what-is-jev.md`、`research/poc-results.md`
- UI デザイン：`docs/app-design.md` §6.4、`docs/design/mockups/`

## セットアップ

```sh
npm install
cp .env.local.example .env.local   # TYPESAFE_API_KEY を設定する
npm run dev                         # http://localhost:3000
```

| 環境変数 | 内容 |
|---|---|
| `JEV_PROVIDER` | Jev の呼び出し経路。`direct`（TypeSafe 直接 API、既定）か `gateway`（Vercel AI Gateway）。`gateway` は、その経路で評価を回してから使う |
| `TYPESAFE_API_KEY` | `direct` のときの鍵 |
| `AI_GATEWAY_API_KEY` | `gateway` のときの鍵 |

## コマンド

```sh
npm run dev             # 開発サーバー
npm run build           # 本番ビルド
npm test                # テスト（vitest。Jev は呼ばない）
npm run typecheck       # 型チェック
npm run check:puzzles   # 問題データの検証（必須項目、id とファイル名、評価ケースの有無）
npm run eval            # 判定の精度評価（調整用データ・baseline）。実際に Jev を呼ぶので、わずかな費用がかかる
npm run eval -- --all   # baseline / no-facts / en / yesno を比較
npm run eval -- --repeat=3                                   # 3 回実行し、最小値と平均を出す
npm run eval -- --split=holdout --repeat=3 --confirm-holdout # 確認用データ。閾値を凍結した後に 1 回だけ
```

評価ケースは調整用（`split: "dev"`）と確認用（`split: "holdout"`）に分かれている。
確認用の結果を見て閾値や問いの文言を直したら、新しい確認用データを用意する（設計書 §7.2）。

評価は、カテゴリ別の正答率、混同行列、確信度の較正表、正解判定の結果、誤判定の一覧、レイテンシ、コストを出力し、
詳細を `eval/results/` に保存する（git の管理対象外）。要約は `research/poc-results.md` に書く。

## API

| メソッド・パス | 入力 | 出力 |
|---|---|---|
| `GET /api/puzzles` | なし | 問題の一覧（`id`、`title`、`problem`） |
| `POST /api/ask` | `puzzleId`、`question`（200 文字まで） | `verdict`（`yes` / `no` / `unknown` / `invalid`） |
| `POST /api/solve` | `puzzleId`、`answer`（500 文字まで） | `solved`、`matched`、`total`、正解時のみ `truth` |
| `POST /api/reveal` | `puzzleId` | `truth` |

Jev が混み合っている・タイムアウトしたときは 503、それ以外の失敗は 500 を返す。

```sh
curl -X POST localhost:3000/api/ask -H 'Content-Type: application/json' \
  -d '{"puzzleId":"umigame","question":"男は自殺しましたか？"}'
```

## 公開（Vercel）

Vercel Hobby に、GitHub のリポジトリを取り込んで公開している（設計書 §7.4、D7）。`master` に入った変更は自動でデプロイされる。

1. Vercel で「Add New… → Project」からリポジトリを取り込む。Framework は Next.js。
2. 「Environment Variables」に `JEV_PROVIDER=direct` と `TYPESAFE_API_KEY`（Sensitive）を設定する。変えたら再デプロイする。
3. 「Firewall」にレート制限ルールを 1 つ作る：Request Path が `/api/` で始まるリクエストを、IP ごとに 60 秒あたり 60 回まで。
4. TypeSafe には支出の上限・アラートがないので、請求額を定期的に確かめる。
5. 独自ドメインを使うときは「Settings → Domains」で追加し、表示された CNAME を DNS に登録する。

公開前に、その URL で通しプレイ（質問・回答・真相を見る・やり直す、PC 幅とスマホ幅）を確かめる。
コマンドラインから API を試すときは、日本語が UTF-8 で送られることを確かめる（Windows の curl に日本語を直接渡すと文字化けし、判定がすべて「どちらともいえない」のように見える）。

## 構成

- `src/app/page.tsx` — 問題一覧。進行状況の表示は `PuzzleCardStatus.tsx`（クライアント）
- `src/app/puzzles/[id]/` — プレイ画面（`PlayView.tsx`）
- `src/app/api/` — 判定 API
- `src/components/` — 判定の表示（`VerdictLabel.tsx`）、真相の表示、飾り
- `src/lib/jev/client.ts` — Jev の呼び出し（直接 API / Vercel AI Gateway を `JevClient` の裏で切り替える）
- `src/lib/judge.ts` — 質問判定と正解判定
- `src/lib/progress.ts` — 進行状況の保存（ブラウザの localStorage）
- `data/puzzles/` — 問題（`truth` / `facts` / `keyPoints` はサーバーの外に出さない）
- `eval/cases/` — 評価ケース。否定疑問文の期待値は日本語の慣習に従う（「〜ではないのですか？」の内容が成り立てば `yes`）
