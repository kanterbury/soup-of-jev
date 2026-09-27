import type { JevAnswer, JevClient, JevQuestion } from "./jev/client";
import type { Puzzle } from "./puzzles";

/** クライアントに返す判定。irrelevant と uncertain はどちらも unknown になる */
export type Verdict = "yes" | "no" | "unknown" | "invalid";

/** サーバー側だけで持つ判定。irrelevant（無関係）と uncertain（確信度が低い）を区別する（設計書 Q3） */
export type InternalVerdict =
  "yes" | "no" | "irrelevant" | "uncertain" | "invalid";

export function toPublicVerdict(verdict: InternalVerdict): Verdict {
  return verdict === "irrelevant" || verdict === "uncertain"
    ? "unknown"
    : verdict;
}

export type JudgeOptions = {
  /** state に facts を含めるか（PoC の比較用） */
  useFacts: boolean;
  /** 質問テンプレートと選択肢の説明の言語。問題文・質問そのものは日本語のまま */
  lang: "ja" | "en";
  /** 選択肢を「事実である/事実でない」で表すか、「YES/NO」で表すか */
  labels: "fact" | "yesno";
  /** answer の確信度がこれ未満（または確信度がない）なら uncertain に倒す */
  confidenceThreshold: number;
  /** isValidQuestion の確率がこれ未満なら invalid とする */
  validThreshold: number;
};

export const DEFAULT_JUDGE_OPTIONS: JudgeOptions = {
  useFacts: true,
  lang: "ja",
  labels: "fact",
  // 閾値は評価と同じ値を使うため定数にする（環境変数で上書きしない。設計書 R4）
  confidenceThreshold: 0.5,
  // PoC 3 回目（2026-09-22）では、普通の質問の最小値が 0.42、質問でない入力の最大値が 0.25 だった
  validThreshold: 0.3,
};

export type QuestionJudgement = {
  verdict: Verdict;
  internalVerdict: InternalVerdict;
  /** 閾値を適用する前の Jev の選択 */
  rawChoice: "true" | "false" | "unknown";
  confidence: number | undefined;
  probabilities: Record<string, number> | undefined;
  validProbability: number;
  latencyMs: number;
  inputTokens: number | undefined;
};

const TEMPLATES = {
  ja: {
    answer:
      "真相（truth と facts）だけを根拠に、プレイヤーの質問（playerQuestion）の内容が物語の中で成り立つかを判定してください。",
    fact: {
      true: "質問の内容は真相において事実である",
      false: "質問の内容は真相において事実ではない",
      unknown: "真相からは判断できない、または物語に関係がない",
    },
    yesno: {
      true: "YES",
      false: "NO",
      unknown: "どちらともいえない（真相からは判断できない、または関係がない）",
    },
    // 「物語について」と書くと、無関係な質問まで「質問でない」と判定される（Jev は字義通りに読むため）。
    // 内容が物語に関係あるかは answer 側で判定するので、ここでは質問の形だけを問う。
    valid:
      "プレイヤーの入力（playerQuestion）は、YES か NO で答えられる形の質問である。質問の内容が物語に関係あるかどうかは問わない。",
    keyPoint: (point: string) =>
      `プレイヤーの回答（playerAnswer）は次の要点を含んでいる：「${point}」`,
    consistent:
      "プレイヤーの回答（playerAnswer）は、真相と矛盾する内容や、互いに相反する複数の仮説を含まない。",
  },
  en: {
    answer:
      "Using only the hidden truth (truth and facts), decide whether the content of the player's question (playerQuestion) holds in the story.",
    fact: {
      true: "The content of the question is a fact in the truth",
      false: "The content of the question is not a fact in the truth",
      unknown:
        "Cannot be determined from the truth, or irrelevant to the story",
    },
    yesno: {
      true: "YES",
      false: "NO",
      unknown: "Neither (cannot be determined from the truth, or irrelevant)",
    },
    valid:
      "The player's input (playerQuestion) is a question in a form that can be answered with YES or NO, regardless of whether its content is related to the story.",
    keyPoint: (point: string) =>
      `The player's answer (playerAnswer) contains this key point: "${point}"`,
    consistent:
      "The player's answer (playerAnswer) contains nothing that contradicts the truth, and does not list multiple mutually conflicting hypotheses.",
  },
} as const;

export async function judgeQuestion(
  client: JevClient,
  puzzle: Puzzle,
  playerQuestion: string,
  options: JudgeOptions = DEFAULT_JUDGE_OPTIONS,
): Promise<QuestionJudgement> {
  const t = TEMPLATES[options.lang];
  const state = {
    problem: puzzle.problem,
    truth: puzzle.truth,
    ...(options.useFacts ? { facts: puzzle.facts } : {}),
    playerQuestion,
  };
  const questions: Record<string, JevQuestion> = {
    answer: {
      type: "choice",
      instructions: t.answer,
      criteria: { ...t[options.labels] },
    },
    isValidQuestion: { type: "boolean", instructions: t.valid },
  };

  const result = await client.evaluate(state, questions);
  const answer = expectType(result.answers.answer, "choice");
  const validProbability = expectType(
    result.answers.isValidQuestion,
    "boolean",
  ).probability;
  const rawChoice = answer.choice as QuestionJudgement["rawChoice"];

  // 設計書 §4.3 の合成ルール（上から順に判定する）
  let internalVerdict: InternalVerdict;
  if (validProbability < options.validThreshold) internalVerdict = "invalid";
  else if (
    answer.confidence === undefined ||
    answer.confidence < options.confidenceThreshold
  )
    internalVerdict = "uncertain";
  else if (rawChoice === "true") internalVerdict = "yes";
  else if (rawChoice === "false") internalVerdict = "no";
  else internalVerdict = "irrelevant";

  return {
    verdict: toPublicVerdict(internalVerdict),
    internalVerdict,
    rawChoice,
    confidence: answer.confidence,
    probabilities: answer.probabilities,
    validProbability,
    latencyMs: result.latencyMs,
    inputTokens: result.inputTokens,
  };
}

export type SolutionOptions = {
  lang: "ja" | "en";
  /** 要点を含んでいるとみなす確率 */
  pointThreshold: number;
  /** 矛盾や相反する仮説を含まないとみなす確率（設計書 §4.4） */
  consistencyThreshold: number;
};

export const DEFAULT_SOLUTION_OPTIONS: SolutionOptions = {
  lang: "ja",
  pointThreshold: 0.7,
  // 公開前評価の調整用データ（dev）で決めた値（2026-09-23）。誤りの混ざった回答の最大値 0.72 と、
  // 正しい回答の最小値 0.92 の間に置いた。確認用データ（holdout）の評価の前に凍結する（設計書 §7.2）
  consistencyThreshold: 0.8,
};

export type SolutionJudgement = {
  solved: boolean;
  /** 満たした要点の数（要点の中身はクライアントに返さない） */
  matched: number;
  total: number;
  pointProbabilities: number[];
  /** 回答が矛盾や相反する仮説を含まない確率 */
  consistentProbability: number;
  latencyMs: number;
};

/**
 * 要点ごとの boolean 質問と、矛盾がないかの boolean 質問を並列で投げ、コード側で合成する。
 * 正解の条件は「すべての要点を含み、かつ矛盾や相反する仮説を含まない」（仮説の羅列で正解にならないようにする。設計書 R3）。
 */
export async function judgeSolution(
  client: JevClient,
  puzzle: Puzzle,
  playerAnswer: string,
  options: Partial<SolutionOptions> = {},
): Promise<SolutionJudgement> {
  const { lang, pointThreshold, consistencyThreshold } = {
    ...DEFAULT_SOLUTION_OPTIONS,
    ...options,
  };
  const t = TEMPLATES[lang];
  const questions: Record<string, JevQuestion> = {
    ...Object.fromEntries(
      puzzle.keyPoints.map((point, i) => [
        `kp${i}`,
        { type: "boolean", instructions: t.keyPoint(point) },
      ]),
    ),
    consistent: { type: "boolean", instructions: t.consistent },
  };
  const result = await client.evaluate(
    { problem: puzzle.problem, truth: puzzle.truth, playerAnswer },
    questions,
  );

  const pointProbabilities = puzzle.keyPoints.map(
    (_, i) => expectType(result.answers[`kp${i}`], "boolean").probability,
  );
  const consistentProbability = expectType(
    result.answers.consistent,
    "boolean",
  ).probability;
  // matched は矛盾の判定に関係なく、要点ごとの判定だけで数える
  const matched = pointProbabilities.filter((p) => p >= pointThreshold).length;
  return {
    solved:
      matched === puzzle.keyPoints.length &&
      consistentProbability >= consistencyThreshold,
    matched,
    total: puzzle.keyPoints.length,
    pointProbabilities,
    consistentProbability,
    latencyMs: result.latencyMs,
  };
}

function expectType<T extends JevAnswer["type"]>(
  answer: JevAnswer | undefined,
  type: T,
): Extract<JevAnswer, { type: T }> {
  if (!answer || answer.type !== type) {
    throw new Error(
      `Jev の回答が想定外です（期待: ${type}, 実際: ${answer?.type ?? "なし"}）`,
    );
  }
  return answer as Extract<JevAnswer, { type: T }>;
}
