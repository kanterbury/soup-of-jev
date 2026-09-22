# TypeSafe AI「Jev」調査レポート（技術仕様重点）

*調査日：2026年9月20日／情報源：公式（typesafe.ai、docs.typesafe.ai）、報道、第三者検証*

## TL;DR（要約）
- **Jev（ジェブ）は、TypeSafe AIが2026年9月15日に早期アクセス提供を開始した「System One Model（システム・ワン・モデル）」の第一弾**で、従来のLLMと異なり**テキストを一切生成せず、型付き（typed）の構造化された判断結果と確率・確信度のみを返す**非自己回帰（non-autoregressive）モデルである。分類・ルーティング・採点・ガードレール検証などソフトウェア組み込み用途に特化する。
- 公式主張の中核は、**入力100万トークンあたり$0.042・出力無料、応答70〜500ms、既存LLM比で最大193.6倍高速・444.6倍安価、型エラー率0%（＝スキーマ外出力は原理的に発生しない）**。ただしこれらのベンチマークはすべてTypeSafe自社評価であり、独立再現は限定的。
- **提供形態はホスト型API（早期アクセス、ウェイティングリスト制）のみ**。オープンウェイト・パラメータ数・アーキテクチャ詳細・自己ホストは未公開。Vercel AI Gateway、Cloudflare Workers AI、LangChain経由でも利用可能。日本語（CJK）は入力可能だが「英語が最も高精度」と公式が明言しており本番前の実測が必須。

---

## 1. モデル概要

| 項目 | 内容 |
|---|---|
| モデル名 | Jev（ジェブ）。経済学者William Stanley Jevons（ジェヴォンズのパラドックス）に由来 |
| 発表元 | TypeSafe AI（米サンフランシスコ、2024年設立） |
| 発表日 | 2026年9月15日（ステルス解除と同時に早期アクセス開始）※一部報道は9月14/16日と表記 |
| モデル区分 | System One Model（同社造語。カーネマン『ファスト＆スロー』のSystem 1に由来） |
| 現行バージョン | jev-1.13.0（エイリアス：jev-latest、jev-preview） |
| 位置づけ | 「フロンティア知能のfunction call」。ソフトウェアが直接消費する高速・構造化された意思決定プリミティブ |
| 用途 | 分類、ルーティング、採点、抽出、ガードレール/ジェイルブレイク検知、エージェントのツール選択・行動制御、大規模データのmap-reduce判断、リアルタイム制御 |
| 非対象用途 | チャット、文章生成、コード生成、要約、説明生成、正確な計算・日付処理、多段推論（System 2タスク） |

**TypeSafe AIについて**：創業者・CEOは元OpenAI研究者のDiogo Almeida（ディオゴ・アルメイダ）。RLHF/InstructGPT/ChatGPT/GPT-4の基礎研究に貢献し、OpenAIのGPT-4コントリビュータ記録に「Foundational RLHF and InstructGPT work」として記載。2024年にOpenAIを退社しTypeSafeを創業。共同創業者はErik Gafni（CTO、Invitae/Freenome等の経歴、DNAシーケンシング向けMLのRavel創業者）とSasha Sheng（COO、Meta/FAIRで約7年間リサーチエンジニア、NeurIPS/ECCV発表歴）。2026年9月15日にDCVC主導の$40M（約4,000万ドル）シードラウンドで調達しステルス解除。Forbes（Rashi Shrivastava、The Prompt、2026-09-15、見出し「This $200 Million Startup Wants To Fix AI's Overconfidence Problem」）は「$40Mシードラウンドがスタートアップを$200M（2億ドル）で評価した（取引に詳しい人物による）」と報道。約2年間ステルス開発。法務はWilson Sonsiniが担当。

出典：https://typesafe.ai/blog/introducing-system-one-models-and-jev ／ https://typesafe.ai/team ／ https://finance.yahoo.com/technology/ai/articles/typesafe-ai-emerges-stealth-40m-190000776.html ／ https://www.forbes.com/sites/the-prompt/2026/09/15/this-200-million-startup-wants-to-fix-ais-overconfidence-problem/ ／ https://siliconangle.com/2026/09/16/typesafe-ai-exits-stealth-with-40m-to-build-ai-for-use-by-software/ ／ https://aiwiki.ai/wiki/typesafe_ai

---

## 2. アーキテクチャ

| 項目 | 内容 | 確度 |
|---|---|---|
| ベース | 「TransformerベースだがLLMではない」（MarkTechPost）。公式は「新しいモデルアーキテクチャ」とのみ表現し詳細非公開 | 公式は詳細未公開 |
| 生成方式 | 非自己回帰（non-autoregressive）。トークンを逐次生成せず、全出力を**単一の並列クエリ（parallel sampler）**で生成 | 公式 |
| パラメータ数 | **未公開** | ― |
| 層数・MoE等の構造 | **未公開** | ― |
| 学習手法 | **RLCD（Reinforcement Learning for Calibrated Decisions／較正済み意思決定のための強化学習）**。RLHF（人間の選好）やRLVR（検証可能報酬）と対比し、「意思決定タスクにおける認識論的に正直な確率（epistemically honest probabilities）」を最適化 | 公式 |
| 事前学習データ | **出典・詳細ともほぼ未公開**。公式ブログのFAQに「Where does our training data come from?」項目はあるが具体的開示は限定的 | ほぼ未確認 |
| ナレッジカットオフ | **未公開**。なおJevは「渡されたstate以外の世界知識を持たない」設計思想のため、外部知識より入力stateに依存 | 未確認 |

**設計思想**：出力の候補空間をスキーマで事前定義するため、スキーマ外の値（型エラー）は「数学的に不可能」。ただしこれは「型安全（schema safety）」であって「意味的正しさ」の保証ではない点に注意（有効な選択肢の中で誤答しうる）。

出典：https://typesafe.ai/blog/introducing-system-one-models-and-jev ／ https://www.datacamp.com/blog/system-one-models-jev ／ https://www.marktechpost.com/2026/09/19/typesafe-ai-releases-jev/ ／ https://www.artificialintelligence-news.com/news/chatgpt-pioneer-launches-jev-model-for-programmatic-logic/

---

## 3. コンテキスト長・入出力・対応言語

| 項目 | 内容 |
|---|---|
| コンテキスト上限 | 1リクエストあたり合計**約64Kトークン**。うち**state＋最長の質問1つで約32Kトークン**（約15万文字相当）に収める必要がある二重制約 |
| 入力モダリティ | **テキストのみ**（文字列、JSONオブジェクト、テキスト配列）。画像・音声・動画・バイナリは事前にテキスト/構造化フィールドへ変換が必要 |
| 出力 | 型付き構造化値（Choice／Score／Noul）＋確率分布＋確信度。自由文は生成しない |
| 対応言語 | **英語が最も高精度**。中国語・日本語等のCJKも「受け付ける（accepted）」が同等精度ではなく、公式は非英語ワークロードの自己検証を推奨 |
| 日本語対応 | 入力・判断は可能。第三者の小規模日本語テストでは良好な結果（後述）だが公式の正式サポート表明はなく「未確認（実測必須）」 |

出典：https://docs.typesafe.ai/models ／ https://flaviocopes.com/jev/ ／ https://omniakey.com/blog/jev-model-explained ／ https://docs.typesafe.ai/model-jaggedness/jev-1.13

---

## 4. 機能（API・プリミティブ）

Jevは3種類の「質問（プリミティブ）」を持ち、**1リクエスト内で複数質問を並列・独立に同一stateへ評価**できる（質問追加による応答時間増はわずか、追加分の入力トークンのみ課金）。質問間は独立評価のため相互に条件づけされず、依存関係はコード側で明示する必要がある。

| プリミティブ | 問い | 返り値 | 備考 |
|---|---|---|---|
| Choice | 選択肢から1つ選ぶ | choice, probabilities, confidence | 最大255（Vercel Gateway経由では64）選択肢 |
| Score | ルーブリック/段階で採点 | score, probabilities, confidence | 2〜10段階（levels） |
| Noul | 記述は真か？ | noul（0〜1の確率） | confidenceフィールドなし（値自体が「はい」の確率） |

- **確信度（confidence）が実質的な製品価値**：確率分布の形状から算出され、RLCDにより較正済み（「確信度0.9は約90%正答」が集団として成立）。高確信度は自動処理、中間はレビュー、低確信度は人間へ、という閾値設計が可能。
- **エンドポイント**：`POST https://api.typesafe.ai/v1/systemone`（bodyに`state`, `model`, `questions`マップ）。全モデルが同一エンドポイント、`model`フィールドで選択。
- **SDK**：Python（`pip install typesafe-sdk`, Python 3.10+、初版2026-09-14）、JavaScript/TypeScript（`@typesafe-ai/sdk`）。cURLおよびClaude Code向けエージェントスキルも提供。
- **エコシステム連携**：LangChain（`TypeSafeClassifier`、`langchain-typesafe`）、Vercel AI SDK（`experimental_evaluate` API）、多数のコミュニティMCPサーバー（typesafe-mcp、jev-mcp、mcp_typesafe等）。
- **「TypeSafe」社名関連の独自機能**：型安全性そのものが中核設計。出力を事前定義スキーマに拘束し、パース/バリデーション不要、型エラー率0%を構造的に保証。これは従来のfunction calling/構造化出力（JSONモード＝生成テキストの構文制約）と異なり、**回答空間そのものを制約**し全確率分布を返す点が差別化。

出典：https://docs.typesafe.ai/introduction ／ https://www.marktechpost.com/2026/09/19/typesafe-ai-releases-jev/ ／ https://omniakey.com/blog/jev-model-explained ／ https://developers.cloudflare.com/ai/models/typesafe/jev/ ／ https://qiita.com/rairaii/items/8673b117096eb0e7e267

---

## 5. 推論性能

| 項目 | 値 | 確度 |
|---|---|---|
| エンドツーエンド応答時間 | 70〜500ms（公式）。デモ実測で0.114秒／件の例 | 公式主張 |
| 速度優位性 | System One型クエリで既存LLM比40〜200倍高速（公式）。ワークフロー評価で最大193.6倍 | 公式評価 |
| コスト優位性 | 40〜400倍安価（公式）。ワークフロー評価で最大444.6倍 | 公式評価 |
| レート制限 | 250,000トークン/秒、1,200リクエスト/分（早期アクセス中は動的変更、429返却） | 公式 |
| 必要ハードウェア | ホスト型APIのみのため利用者側GPU不要。自己ホスト/量子化対応は該当なし（ウェイト非公開） | 公式 |
| 量子化対応 | 該当なし（オープンウェイト未提供） | ― |

**「193.6倍/444.6倍」の内訳**：Forbes（Josipa Majić、2026-09-19「Jev Cuts AI Decision Costs 100x And Vercel, Cloudflare Rushed To Add It」）によれば、「Sonnet 5は同一スコアに78.1秒・1件あたり294倍のコストで到達しており、これが193.6倍の速度差の由来。444.6倍のコスト差はClaude Opus 5に対するもの」。すなわち比較対象モデルによって倍率が異なる。

**注意**：東京等からVercel/Cloudflare Gateway経由の場合、ネットワーク往復で数百ms上乗せされうる（第三者検証、AI Native）。公式レイテンシは米国西海岸のノートPCから測定とTypeSafeが明記。

出典：https://typesafe.ai/blog/introducing-system-one-models-and-jev ／ https://docs.typesafe.ai/models ／ https://www.forbes.com/sites/josipamajic/2026/09/19/jev-cuts-ai-decision-costs-100x-and-vercel-cloudflare-rushed-to-add-it/ ／ https://www.ai-native.jp/blog/typesafe-jev-system-one-model-guide

---

## 6. ベンチマーク結果

### 6-1. 公式評価（vendor-reported）
TypeSafeは独自の「ワークフロー評価（workflow evals）」を実施。4ワークフロー（セキュリティインシデント対応、エージェントトレース観測、請求書処理、カスタマーサービス）で、**GPT-6 AstraとFable 5.1（Anthropic）の平均予測を参照解答（reference）**として各モデルの一致率を測定。

| モデル | 精度 | 1件あたりコスト | レイテンシ |
|---|---|---|---|
| Jev（TypeSafe） | 67.8% | $0.0004 | 0.4秒 |
| GPT-5.6 Terra | 67.9% | $0.0304 | 10.1秒 |
| GPT-5.6 Sol | 74.1% | $0.0836 | 23.3秒 |
| Claude Opus 5 | 73.1% | $0.1761 | 37.8秒 |

- **構造化出力エラー率**：Jev 0%（構造上保証、非実測）。比較対象はOpenAI luna/terra 0.58%、Opus 5 5.73%、Claude Haiku 4.5 45.5%。
- **ツールコールエラー率**：Jev 0%、GPT-5.6 Solが最悪17.0%。
- **公式が自認するバイアス**：①ワークフローは自社の能力評価チームが作成、②参照解答がOpenAI/Anthropic系モデルのためそれらに有利（DeepSeek等は過小評価の可能性）、③比較LLMは自社の構造化アダプタ経由で実行、④193.6倍/444.6倍は「実世界ゲインの上限側」。

出典：https://typesafe.ai/blog/introducing-system-one-models-and-jev ／ https://evals.typesafe.ai/ ／ https://www.datacamp.com/blog/system-one-models-jev

### 6-2. 第三者・独立検証（区別して記載）
- **独立再現の総括**：Arize AI、TrueFoundryとも「TypeSafeの公式数値は自社評価であり独立再現されていない」と明言。大規模独立再現は2026年9月下旬時点で未登場。TrueFoundryは193.6倍/444.6倍を「自己申告・未再現」と明記。
- **フィッシングメール検証（独立、再現可能）**：GitHub `anisselbd/jev-phishing-bench`（2026-09-17）。2,000通（フィッシング1,000＋正当1,000）で**Jev 62.6%精度 vs Claude Haiku 4.5 81.3%**（Jevが単一判定では明確に劣る、McNemar p<0.0001）。ただしJevはレイテンシp50 239ms（Haiku 687ms）・コスト約12倍安。著者は「Jev自身の単一判定は精度で明確に負け、速度とコストで勝つ」とした上で、**同一コール内で5つの狭い信号質問（例：無料ホスティング検知は単独でAUROC 0.96）＋ロジスティック回帰に分解するとJevの精度は約95%に向上、Haikuは同方式で93%**（出典：amankumar.ai要約）と報告。※メール本文はLLM生成の半合成データ、正解はURL評価フィード由来。
- **Vercelコマンド安全性分類（開発者テスティモニアル）**：VercelエンジニアPranit Sharmaが、安全性分類器をChatGPT Luna 5.6からJevに置換し「5〜18倍高速かつ高精度」と報告。CEO Guillermo Rauchはp95で最大18倍高速と表現。ただしベンチマーク自体は未公開、具体的精度%は非開示。
- **Bryo AIメールトリアージ（開発者テスティモニアル）**：CTO Nikhil Mudholkarが「Geminiがわずかに高精度だが10〜20倍高コスト」、Jevの較正済み確率を高評価。具体的%非開示。
- **Every（独立、Head of Evals Mike Taylor）**：37文書×21質問＝**777判定を0.7秒未満・推定約¼セント（0.25セント）で実行**（"In less than 0.7 seconds, Jev 'read' all 37 documents and answered all 21 questions for each, returning 777 judgments, for an estimated quarter of a cent."）。別テストでは**Jev中央値0.35秒/文 vs Claude Fable 5.1（high effort）8.83秒（約25倍高速、コスト約1/580）。植込み欠陥はJev 7個中6個検出、Fable 5.1は7個全検出**（"Jev caught six of the seven intended defects; Fable caught all seven."）。
- **Arize/NearHere（小規模第三者）**：メール分類でJev 98.3% vs TF-IDFロジスティック回帰98.4%（有意差なし）。Arizeは「未再現の初期データ」と留保。
- **日本語ハンズオン（独立、小規模）**：AI Native（田中慎氏、2026-09-18、Vercel Gateway経由・東京）。日本語問い合わせ12件×5問。Choice部門振分12/12、緊急度Noul 12/12、営業判定12/12、プロンプトインジェクション検知12/12、Score案件具体度10/12。60判定を357ms（処理）/$0.00042で実行。同一12件でgpt-5.6-luna（JSON strict）と比較しScoreはJev 10/12 vs Luna 8/12、分類はほぼ同等、速度はJevが約1桁高速。小規模ながら日本語で英語比の精度劣化は見られず。※n=12・単発実行のため一般化不可。

出典：https://arize.com/blog/typesafe-jev-llm-judge/ ／ https://www.truefoundry.com/blog/typesafe-ai-jev ／ https://github.com/anisselbd/jev-phishing-bench ／ https://techcrunch.com/2026/09/18/a-new-kind-of-ai-model-from-a-chatgpt-inventor-is-thrilling-developers/ ／ https://every.to/also-true-for-humans/mini-vibe-check-typesafe-s-jev-judged-everything-i-ve-written-in-0-7-seconds ／ https://www.ai-native.jp/blog/typesafe-jev-system-one-model-guide

---

## 7. 提供形態・価格・アクセス

| 項目 | 内容 |
|---|---|
| 提供形態 | ホスト型API（早期アクセス、ウェイティングリスト制）。オープンウェイト・自己ホスト・オンプレ・VPC提供は無し（現時点・計画も無しと回答） |
| ライセンス | プロプライエタリ |
| 価格 | 入力$0.042/100万トークン（$42/10億トークン）、**出力トークン無料**（"too cheap to meter"）。1件あたり約$0.0004 |
| モデルID | `jev-1.13.0`（バージョン固定）／`jev-latest`（最新追従エイリアス）／`jev-preview` |
| エンドポイント | `POST https://api.typesafe.ai/v1/systemone` |
| SDK | Python（`typesafe-sdk`）、JS/TS（`@typesafe-ai/sdk`） |
| 第三者経由 | Vercel AI Gateway（`typesafe-ai/jev`、ウェイトリスト不要）、Cloudflare Workers AI（`typesafe/jev`、32Kコンテキスト表記）、LangChain、Langfuse、Opper等 |
| コンソール | console.typesafe.ai（Playground、cookbook、demos） |

**採用状況**：Vercelはブログ「Jev is the fastest-adopted model in AI Gateway history」で「ローンチ24時間時点で有料チームのほぼ13%が利用。これはGPT-5.6ファミリーの2倍、Fable 5.1の6倍超。Jevは18時間で1割のチームに到達し、他の最近のモデルはいずれも1日経過後も7%未満だった」と発表。Vercel・Cloudflare・LangChain・Langfuseが3日以内に統合。需要急増で一時API提供が停止した。

出典：https://docs.typesafe.ai/models ／ https://vercel.com/changelog/typesafe-ai-jev-now-available-on-ai-gateway ／ https://vercel.com/blog/ai-gateway-jev-model-launch ／ https://developers.cloudflare.com/ai/models/typesafe/jev/ ／ https://www.forbes.com/sites/josipamajic/2026/09/19/jev-cuts-ai-decision-costs-100x-and-vercel-cloudflare-rushed-to-add-it/

---

## 8. 既知の制限事項・安全性

**公式が開示する「jaggedness（弱点）」（jev-1.13）**：
- テキスト生成不可（Choiceの連鎖で強制しても低速・低品質）。
- 計算・算術・日付・数値精度が不得手（数学ロジックはコードで実装推奨）。
- 質問文を字義通りに解釈（scoping語、否定、暗黙条件を額面通り読む）。意図ではなく記述に回答。
- 多段の間接参照（indirection）が弱い。
- **コンテキストロット**：stateに質問と無関係な情報が増えると精度低下。事前にコードでフィルタ推奨。
- 敵対的入力/プロンプトインジェクションへの脆弱性（stateをデフォルトで敵対的とは扱わない）。
- 別々に問うた確率が直感的な恒等式に従わないことがある。

**安全性・「ハルシネーションなし」の正確な意味**：
- 「型エラー0%／ハルシネーション不可」は**スキーマ外出力が構造的に起きない**という意味（schema safety）であり、**意味的正しさの保証ではない**。有効な選択肢内での誤答・過信は起こりうる。0%は非実測（構造上の帰結として0を計上）。
- 説明可能性の欠如：確率のみで自然言語の根拠を返さない。規制業界の監査・デバッグには制約。
- ジェイルブレイク/ガードレール検知はTypeSafeが主力に据える用途だが、「フィルタであってセキュリティ境界ではない」（コミュニティ実装の注記）。

**データ取扱い・ガバナンス**：
- プライバシーポリシー（2025年11月19日付）で顧客入力をモデル学習/ファインチューニングに使用しない、サービスプロバイダ以外の第三者に開示しないと明記。ホスティングは米国。保持期間は「合理的に必要な期間」。
- **ゼロデータ保持（ZDR）はエンタープライズ階層のみ**。他階層の保持期間は明示なし。Vercel Gateway経由ではリクエスト単位でZDR/No Trainingを有効化可能。
- SLA・可用性コミットメントは公表されていない。

出典：https://docs.typesafe.ai/model-jaggedness/jev-1.13 ／ https://www.datacamp.com/blog/system-one-models-jev ／ https://omniakey.com/blog/jev-model-explained ／ https://www.modemguides.com/blogs/ai-news/jev-typesafe-reality-check-run-locally ／ https://kingy.ai/blog/typesafe-jev-review-the-ai-model-that-doesnt-generate-text/

---

## 9. 競合・代替との比較

| 観点 | Jev（System One） | フロンティアLLM（GPT-5.6/Opus 5等） | 従来型分類器 |
|---|---|---|---|
| 主目的 | 境界の定まった意味的判断 | 自由文生成・推論 | 固定タスクのラベル予測 |
| 出力 | 型付き値＋確率（スキーマ保証） | 生成文字列（要パース） | 学習済み固定ラベル |
| 新ルーブリック | リクエストで記述 | プロンプト/スキーマ | 通常は再学習が必要 |
| 確率 | 第一級出力・較正済み | 不安定/過信 | モデルが出せば利用可 |
| テキスト生成 | 不可 | 可 | 不可 |
| 最適な役割 | ワークフロー内の意味的分岐 | 生成・説明・コード・多段推論 | ラベル付きデータのある高頻度タスク |

**位置づけの結論**：JevはGPT-5.6やOpus 5と同じ土俵で競合せず、**両者を組み合わせる**設計が推奨される（Jevが高速・低コストで分類/採点/ルーティングし、確信度閾値で難case・生成が必要なcaseをLLMへエスカレーション）。文章生成・説明・多段推論が必要ならLLM、正確な計算・権限判定はコードが担う。TypeSafe自身も「Jevは意思決定レイヤーであって完結したAIアプリではない」と位置づける。TrueFoundryは本ローンチを「ベンチマークというよりアーキテクチャ上のシグナル（モデル選択問題からオーケストレーション問題へ）」と評価。

出典：https://omniakey.com/blog/jev-model-explained ／ https://www.datacamp.com/blog/system-one-models-jev ／ https://www.truefoundry.com/blog/typesafe-ai-jev

---

## 10. 推奨アクション（評価・導入判断向け）

1. **PoCの第一歩**：既存システムのLLM呼び出しのうち「出力がenum/真偽/数値になっているもの」を洗い出し、Choice/Score/Noulに分解してJevへ置換候補とする。まずVercel AI Gateway（`typesafe-ai/jev`、ウェイトリスト不要）で低リスクに試すのが最短。
2. **精度検証は必ず自社データで**：公式67.8%・193.6倍等はすべてvendor評価。独立フィッシング検証では単一判定でHaikuに劣る（62.6% vs 81.3%）例もあるため、**単一質問を複数の狭い信号質問に分解＋コード側で合成**する設計（同検証で95%まで向上）を前提にベンチマークする。
3. **確信度で自動化を段階制御**：RLCDの較正済み確率を活かし、「高確信度→自動処理／中間→レビュー／低確信度→人間orLLM」の閾値をアクションのコストごとに設定。
4. **日本語ワークロード**：小規模独立テストでは分類系で英語同等の結果だが、Scoreや案件具体度で誤りが出た。**本番投入前にn十件規模で自社の日本語データを実測**すること。
5. **ガバナンス上の判断基準（切り替えを促す閾値）**：ZDR必須ならエンタープライズ契約が前提。オンプレ/VPC要件がある、SLAが必須、あるいは説明可能性（監査根拠）が法的に必要な用途では、現状のJev（米国ホスト・ホストAPIのみ・根拠テキストなし）は不適合。これらの要件が緩い高頻度・低単価の判断レイヤーが最適解。
6. **監視ポイント**：①独立ベンチマーク（Arize等）が公式数値を再現するか、②早期アクセスの価格が補助金なしで維持されるか（公式も証明不可と認める）、③レート制限の安定化とSLA公表。これらが好転すれば適用範囲を拡大、悪化すれば代替（従来分類器/小型FTモデル）を検討。

---

## 11. 未確認事項・情報の信頼度に関する注記

**未確認（公式非公開）**：
- パラメータ数、層数、MoE等の内部構造、アーキテクチャ詳細。
- 事前学習データの出所・規模、ナレッジカットオフ日。
- SLA・可用性保証、正式な価格改定方針。

**信頼度の区別**：
- **公式一次情報**（typesafe.ai、docs.typesafe.ai）：発表日、価格、API仕様、コンテキスト上限、プリミティブ、RLCD、jaggedness、データ取扱い。
- **公式評価（vendor-reported、要留保）**：67.8%精度、193.6倍高速/444.6倍安価、70〜500ms、型エラー0%。参照解答が他社モデル平均であり、ワークフローも自社作成のためバイアスを公式が自認。**独立再現は限定的**。
- **第三者独立検証（小規模・部分的）**：フィッシング検証（62.6% vs 81.3%）、日本語テスト（AI Native）、Every（Mike Taylor）、Arize/NearHere等。いずれも小規模・単発で一般化不可。開発者テスティモニアル（Vercel、Bryo AI）はベンチマーク未公開。

**同名混同への注意**：「TypeSafe」はScala関連の旧Typesafe社（現Lightbend）や一般的なプログラミング用語、「Typewise」（スイスの別企業）と混同しないこと。本レポートの対象は2026年設立・Diogo Almeida創業のTypeSafe AI（typesafe.ai）およびそのモデルJevに限定して確認済み。ニュースにより創業者名が「Diego Almeida」と誤記される例が見られるが、正しくは**Diogo Almeida**。