# Soup of Jev（PoC）

水平思考クイズのプレイヤーの質問を、TypeSafe AI の Jev で「YES / NO / どちらともいえない」に判定する PoC。
背景は `research/what-is-jev.md` を参照。

## セットアップ

```sh
npm install
cp .env.local.example .env.local   # AI_GATEWAY_API_KEY か TYPESAFE_API_KEY を設定
```

## 精度評価

```sh
npm run eval                        # baseline（facts あり・日本語テンプレート・「事実である/ない」表記）
npm run eval -- --all               # baseline / no-facts / en / yesno を比較
npm run eval -- --puzzle=bar --threshold=0.6
```

カテゴリ別の正答率、混同行列、確信度の較正表、正解判定の結果、誤判定の一覧、レイテンシ、コストを出力し、
詳細を `eval/results/` に保存する。

## API

```sh
npm run dev
curl -X POST localhost:3000/api/ask   -d '{"puzzleId":"umigame","question":"男は自殺しましたか？"}'
curl -X POST localhost:3000/api/solve -d '{"puzzleId":"umigame","answer":"..."}'
curl localhost:3000/api/puzzles
```

## 構成

- `src/lib/jev/client.ts` — Jev の呼び出し（Vercel AI Gateway / 直接 API を `JevClient` の裏で切り替える）
- `src/lib/judge.ts` — 質問判定（Choice ＋ 質問として有効かの判定 ＋ 重要度）と正解判定（要点ごとの判定をコード側で合成）
- `data/puzzles/` — 問題（`truth` / `facts` / `keyPoints` はサーバーの外に出さない）
- `eval/cases/` — 評価ケース。否定疑問文の期待値は日本語の慣習に従う（「〜ではないのですか？」の内容が成り立てば `yes`）
