import {
  APICallError,
  experimental_evaluate as evaluate,
  RetryError,
} from "ai";

// 質問と回答の型は AI SDK の evaluate API の語彙（choice / score / boolean）に揃える。
// 直接 API では boolean を "noul" と呼ぶので、DirectJevClient 側で変換する。
export type JevQuestion =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] }
  | {
      type: "boolean";
      instructions: string;
      criteria?: { true: string; false: string };
    };

export type JevAnswer =
  | {
      type: "choice";
      choice: string;
      probabilities?: Record<string, number>;
      confidence?: number;
    }
  | {
      type: "score";
      score: number;
      probabilities?: Record<string, number>;
      confidence?: number;
    }
  | { type: "boolean"; probability: number };

export type JevState = string | Record<string, unknown> | unknown[];

export type JevResult = {
  answers: Record<string, JevAnswer>;
  inputTokens?: number;
  latencyMs: number;
};

export interface JevClient {
  readonly name: string;
  evaluate(
    state: JevState,
    questions: Record<string, JevQuestion>,
  ): Promise<JevResult>;
}

/** 評価に使ったモデル。変えるときは評価をやり直す（設計書 R4） */
export const JEV_MODEL = "jev-1.13.0";

/** 1 回の通信のタイムアウト */
const REQUEST_TIMEOUT_MS = 5000;
/** 429 / 529 の再試行で待つ時間の合計の上限 */
const RETRY_BUDGET_MS = 3000;

/**
 * 混雑や通信の失敗など、時間をおけば直る可能性のある失敗（429・529・タイムアウト・通信エラー）。
 * API ルートはこれを 503 にし、それ以外の失敗は 500 にする（設計書 R6）。
 */
export class JevUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "JevUnavailableError";
  }
}

const isBusyStatus = (status: number | undefined) =>
  status === 429 || status === 529;
const isAbort = (e: unknown) =>
  e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

/** Vercel AI Gateway 経由（AI_GATEWAY_API_KEY）。本番で使う前に、この経路で評価を回すこと（設計書 Q6）。 */
export class GatewayJevClient implements JevClient {
  readonly name = "gateway:typesafe-ai/jev";

  async evaluate(
    state: JevState,
    questions: Record<string, JevQuestion>,
  ): Promise<JevResult> {
    const startedAt = performance.now();
    let result;
    try {
      result = await evaluate({
        model: "typesafe-ai/jev",
        state: state as Parameters<typeof evaluate>[0]["state"],
        questions,
        abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e) {
      const last = RetryError.isInstance(e) ? e.lastError : e;
      if (
        isAbort(last) ||
        (APICallError.isInstance(last) &&
          (isBusyStatus(last.statusCode) || last.statusCode === undefined))
      ) {
        throw new JevUnavailableError("Jev（Gateway）が応答しません", {
          cause: e,
        });
      }
      throw e;
    }
    const latencyMs = performance.now() - startedAt;

    const confidence = result.providerMetadata?.typesafe?.confidence as
      Record<string, number> | undefined;
    const answers: Record<string, JevAnswer> = {};
    for (const [id, answer] of Object.entries(
      result.answers as Record<string, JevAnswer>,
    )) {
      answers[id] =
        answer.type === "boolean"
          ? answer
          : { ...answer, confidence: confidence?.[id] };
    }
    return { answers, inputTokens: result.usage.inputTokens, latencyMs };
  }
}

type DirectAnswer = {
  type: "noul" | "choice" | "score";
  noul?: number;
  choice?: string;
  score?: number;
  probabilities?: Record<string, number>;
  confidence?: number;
};

/** TypeSafe 直接 API（TYPESAFE_API_KEY）。 */
export class DirectJevClient implements JevClient {
  readonly name = `direct:${JEV_MODEL}`;

  constructor(private readonly apiKey: string) {}

  async evaluate(
    state: JevState,
    questions: Record<string, JevQuestion>,
  ): Promise<JevResult> {
    const body = {
      model: JEV_MODEL,
      state,
      questions: Object.fromEntries(
        Object.entries(questions).map(([id, q]) => [
          id,
          q.type === "boolean" ? { ...q, type: "noul" } : q,
        ]),
      ),
    };

    const startedAt = performance.now();
    const res = await fetchWithRetry("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const latencyMs = performance.now() - startedAt;
    if (!res.ok) {
      throw new Error(`TypeSafe API error ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as {
      answers: Record<string, DirectAnswer>;
      usage?: { input_tokens?: number };
    };
    const answers: Record<string, JevAnswer> = {};
    for (const [id, a] of Object.entries(json.answers)) {
      if (a.type === "noul")
        answers[id] = { type: "boolean", probability: a.noul ?? 0 };
      else if (a.type === "choice")
        answers[id] = {
          type: "choice",
          choice: a.choice ?? "",
          probabilities: a.probabilities,
          confidence: a.confidence,
        };
      else
        answers[id] = {
          type: "score",
          score: a.score ?? 0,
          probabilities: a.probabilities,
          confidence: a.confidence,
        };
    }
    return { answers, inputTokens: json.usage?.input_tokens, latencyMs };
  }
}

// 429（レート制限）/ 529（過負荷）は指数バックオフで再試行する（公式推奨）。
// 待ち時間の合計が RETRY_BUDGET_MS を超えるなら、再試行せずに諦める。
async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let waitedMs = 0;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e) {
      // タイムアウト、または DNS・接続断などの通信エラー
      throw new JevUnavailableError(
        isAbort(e) ? "Jev がタイムアウトしました" : "Jev に接続できません",
        { cause: e },
      );
    }
    if (!isBusyStatus(res.status)) return res;

    const delayMs = 500 * 2 ** attempt;
    if (waitedMs + delayMs > RETRY_BUDGET_MS) {
      throw new JevUnavailableError(`Jev が混み合っています（${res.status}）`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    waitedMs += delayMs;
  }
}

/** 経路は JEV_PROVIDER で明示する（既定は direct）。鍵の有無で自動に選ばない（設計書 Q6）。 */
export function createJevClient(): JevClient {
  const provider = process.env.JEV_PROVIDER ?? "direct";
  if (provider === "direct") {
    if (!process.env.TYPESAFE_API_KEY)
      throw new Error(
        "TYPESAFE_API_KEY を設定してください（.env.local.example を参照）",
      );
    return new DirectJevClient(process.env.TYPESAFE_API_KEY);
  }
  if (provider === "gateway") {
    if (!process.env.AI_GATEWAY_API_KEY)
      throw new Error(
        "AI_GATEWAY_API_KEY を設定してください（.env.local.example を参照）",
      );
    return new GatewayJevClient();
  }
  throw new Error(
    `JEV_PROVIDER は direct か gateway を指定してください（現在: ${provider}）`,
  );
}
