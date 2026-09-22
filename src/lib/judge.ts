import type { JevAnswer, JevClient, JevQuestion } from "./jev/client";
import type { Puzzle } from "./puzzles";

export type Verdict = "yes" | "no" | "unknown" | "invalid";

export type JudgeOptions = {
  /** state に facts を含めるか（PoC の比較用） */
  useFacts: boolean;
  /** 質問テンプレートと選択肢の説明の言語。問題文・質問そのものは日本語のまま */
  lang: "ja" | "en";
  /** 選択肢を「事実である/事実でない」で表すか、「YES/NO」で表すか */
  labels: "fact" | "yesno";
  /** answer の確信度がこれ未満なら unknown に倒す */
  confidenceThreshold: number;
  /** isValidQuestion の確率がこれ未満なら invalid とする */
  validThreshold: number;
};

export const DEFAULT_JUDGE_OPTIONS: JudgeOptions = {
  useFacts: true,
  lang: "ja",
  labels: "fact",
  confidenceThreshold: Number(process.env.JUDGE_CONFIDENCE_THRESHOLD ?? 0.5),
  // PoC（2026-09-22）では、普通の質問の最小値が 0.45、質問でない入力の最大値が 0.24 だった
  validThreshold: 0.3,
};

export type QuestionJudgement = {
  verdict: Verdict;
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
    answer: "真相（truth と facts）だけを根拠に、プレイヤーの質問（playerQuestion）の内容が物語の中で成り立つかを判定してください。",
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
    keyPoint: (point: string) => `プレイヤーの回答（playerAnswer）は次の要点を含んでいる：「${point}」`,
  },
  en: {
    answer:
      "Using only the hidden truth (truth and facts), decide whether the content of the player's question (playerQuestion) holds in the story.",
    fact: {
      true: "The content of the question is a fact in the truth",
      false: "The content of the question is not a fact in the truth",
      unknown: "Cannot be determined from the truth, or irrelevant to the story",
    },
    yesno: {
      true: "YES",
      false: "NO",
      unknown: "Neither (cannot be determined from the truth, or irrelevant)",
    },
    valid:
      "The player's input (playerQuestion) is a question in a form that can be answered with YES or NO, regardless of whether its content is related to the story.",
    keyPoint: (point: string) => `The player's answer (playerAnswer) contains this key point: "${point}"`,
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
    answer: { type: "choice", instructions: t.answer, criteria: { ...t[options.labels] } },
    isValidQuestion: { type: "boolean", instructions: t.valid },
  };

  const result = await client.evaluate(state, questions);
  const answer = expectType(result.answers.answer, "choice");
  const validProbability = expectType(result.answers.isValidQuestion, "boolean").probability;
  const rawChoice = answer.choice as QuestionJudgement["rawChoice"];

  let verdict: Verdict;
  if (validProbability < options.validThreshold) verdict = "invalid";
  else if ((answer.confidence ?? 1) < options.confidenceThreshold) verdict = "unknown";
  else verdict = rawChoice === "true" ? "yes" : rawChoice === "false" ? "no" : "unknown";

  return {
    verdict,
    rawChoice,
    confidence: answer.confidence,
    probabilities: answer.probabilities,
    validProbability,
    latencyMs: result.latencyMs,
    inputTokens: result.inputTokens,
  };
}

export type SolutionJudgement = {
  solved: boolean;
  /** 満たした要点の数（要点の中身はクライアントに返さない） */
  matched: number;
  total: number;
  pointProbabilities: number[];
  latencyMs: number;
};

/** 要点ごとに独立した boolean 質問を並列で投げ、コード側で合成する。 */
export async function judgeSolution(
  client: JevClient,
  puzzle: Puzzle,
  playerAnswer: string,
  { lang = "ja", pointThreshold = 0.7 }: { lang?: "ja" | "en"; pointThreshold?: number } = {},
): Promise<SolutionJudgement> {
  const t = TEMPLATES[lang];
  const questions: Record<string, JevQuestion> = Object.fromEntries(
    puzzle.keyPoints.map((point, i) => [`kp${i}`, { type: "boolean", instructions: t.keyPoint(point) }]),
  );
  const result = await client.evaluate({ problem: puzzle.problem, truth: puzzle.truth, playerAnswer }, questions);

  const pointProbabilities = puzzle.keyPoints.map(
    (_, i) => expectType(result.answers[`kp${i}`], "boolean").probability,
  );
  const matched = pointProbabilities.filter((p) => p >= pointThreshold).length;
  return {
    solved: matched === puzzle.keyPoints.length,
    matched,
    total: puzzle.keyPoints.length,
    pointProbabilities,
    latencyMs: result.latencyMs,
  };
}

function expectType<T extends JevAnswer["type"]>(
  answer: JevAnswer | undefined,
  type: T,
): Extract<JevAnswer, { type: T }> {
  if (!answer || answer.type !== type) {
    throw new Error(`Jev の回答が想定外です（期待: ${type}, 実際: ${answer?.type ?? "なし"}）`);
  }
  return answer as Extract<JevAnswer, { type: T }>;
}
