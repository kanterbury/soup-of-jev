import { experimental_evaluate as evaluate } from "ai";

// 質問と回答の型は AI SDK の evaluate API の語彙（choice / score / boolean）に揃える。
// 直接 API では boolean を "noul" と呼ぶので、DirectJevClient 側で変換する。
export type JevQuestion =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "boolean"; instructions: string; criteria?: { true: string; false: string } };

export type JevAnswer =
  | { type: "choice"; choice: string; probabilities?: Record<string, number>; confidence?: number }
  | { type: "score"; score: number; probabilities?: Record<string, number>; confidence?: number }
  | { type: "boolean"; probability: number };

export type JevState = string | Record<string, unknown> | unknown[];

export type JevResult = {
  answers: Record<string, JevAnswer>;
  inputTokens?: number;
  latencyMs: number;
};

export interface JevClient {
  readonly name: string;
  evaluate(state: JevState, questions: Record<string, JevQuestion>): Promise<JevResult>;
}

/** Vercel AI Gateway 経由（AI_GATEWAY_API_KEY）。 */
export class GatewayJevClient implements JevClient {
  readonly name = "gateway:typesafe-ai/jev";

  async evaluate(state: JevState, questions: Record<string, JevQuestion>): Promise<JevResult> {
    const startedAt = performance.now();
    const result = await evaluate({
      model: "typesafe-ai/jev",
      state: state as Parameters<typeof evaluate>[0]["state"],
      questions,
    });
    const latencyMs = performance.now() - startedAt;

    const confidence = result.providerMetadata?.typesafe?.confidence as
      | Record<string, number>
      | undefined;
    const answers: Record<string, JevAnswer> = {};
    for (const [id, answer] of Object.entries(result.answers as Record<string, JevAnswer>)) {
      answers[id] = answer.type === "boolean" ? answer : { ...answer, confidence: confidence?.[id] };
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
  readonly name = "direct:jev-latest";

  constructor(private readonly apiKey: string) {}

  async evaluate(state: JevState, questions: Record<string, JevQuestion>): Promise<JevResult> {
    const body = {
      model: "jev-latest",
      state,
      questions: Object.fromEntries(
        Object.entries(questions).map(([id, q]) => [id, q.type === "boolean" ? { ...q, type: "noul" } : q]),
      ),
    };

    const startedAt = performance.now();
    const res = await fetchWithRetry("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
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
      if (a.type === "noul") answers[id] = { type: "boolean", probability: a.noul ?? 0 };
      else if (a.type === "choice")
        answers[id] = { type: "choice", choice: a.choice ?? "", probabilities: a.probabilities, confidence: a.confidence };
      else answers[id] = { type: "score", score: a.score ?? 0, probabilities: a.probabilities, confidence: a.confidence };
    }
    return { answers, inputTokens: json.usage?.input_tokens, latencyMs };
  }
}

// 429（レート制限）/ 529（過負荷）は指数バックオフで再試行する（公式推奨）。
async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if ((res.status !== 429 && res.status !== 529) || attempt >= maxRetries) return res;
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
}

export function createJevClient(): JevClient {
  if (process.env.TYPESAFE_API_KEY) return new DirectJevClient(process.env.TYPESAFE_API_KEY);
  if (process.env.AI_GATEWAY_API_KEY) return new GatewayJevClient();
  throw new Error("TYPESAFE_API_KEY または AI_GATEWAY_API_KEY を設定してください（.env.local.example を参照）");
}
