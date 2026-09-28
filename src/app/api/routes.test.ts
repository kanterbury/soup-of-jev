import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  JevUnavailableError,
  type JevAnswer,
  type JevClient,
} from "@/lib/jev/client";
import { MemoryLikeStore, type LikeStore } from "@/lib/likes";
import { getPuzzle, listPublicPuzzles } from "@/lib/puzzles";
import { POST as ask } from "./ask/route";
import { POST as hint } from "./hint/route";
import { GET as getLikes, POST as postLike } from "./likes/route";
import { POST as reveal } from "./reveal/route";
import { POST as solve } from "./solve/route";

const evaluate = vi.fn<JevClient["evaluate"]>();
vi.mock("@/lib/jev/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jev/client")>()),
  createJevClient: (): JevClient => ({ name: "fake", evaluate }),
}));

let likeStore: LikeStore;
vi.mock("@/lib/likes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/likes")>()),
  getLikeStore: () => likeStore,
}));

const post = (body: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const bool = (probability: number): JevAnswer => ({
  type: "boolean",
  probability,
});
const questionAnswers = (choice: string, confidence: number) => ({
  answers: {
    answer: { type: "choice", choice, confidence } as JevAnswer,
    isValidQuestion: bool(0.9),
  },
  latencyMs: 1,
});
const truth = getPuzzle("umigame")!.truth;

beforeEach(() => {
  evaluate.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/ask", () => {
  it("応答は verdict だけ", async () => {
    evaluate.mockResolvedValue(questionAnswers("true", 0.95));
    const res = await ask(
      post({ puzzleId: "umigame", question: "  男は自殺しましたか？  " }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verdict: "yes" });
    expect(evaluate.mock.calls[0][0]).toMatchObject({
      playerQuestion: "男は自殺しましたか？",
    });
  });

  it("確信度が低いときも、無関係のときと同じ unknown を返す", async () => {
    evaluate.mockResolvedValue(questionAnswers("true", 0.3));
    expect(
      await (
        await ask(post({ puzzleId: "umigame", question: "質問？" }))
      ).json(),
    ).toEqual({ verdict: "unknown" });
  });

  it.each([
    ["空白だけの質問", { puzzleId: "umigame", question: "   " }],
    [
      "200 文字を超える質問",
      { puzzleId: "umigame", question: "あ".repeat(201) },
    ],
    ["文字列でない質問", { puzzleId: "umigame", question: 1 }],
    ["JSON でない本文", "not json"],
  ])("%s は 400", async (_, body) => {
    expect((await ask(post(body))).status).toBe(400);
  });

  it("文字数は trim() した後で数える", async () => {
    evaluate.mockResolvedValue(questionAnswers("false", 0.9));
    expect(
      (
        await ask(
          post({ puzzleId: "umigame", question: ` ${"あ".repeat(200)} ` }),
        )
      ).status,
    ).toBe(200);
  });

  it("存在しない問題は 404", async () => {
    expect(
      (await ask(post({ puzzleId: "nope", question: "質問？" }))).status,
    ).toBe(404);
  });

  it("混雑・タイムアウトは 503", async () => {
    evaluate.mockRejectedValue(new JevUnavailableError("busy"));
    const res = await ask(post({ puzzleId: "umigame", question: "質問？" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "混み合っています。少し待ってからもう一度送ってください",
    });
  });

  it("それ以外の失敗は 500 で、原因を返さない", async () => {
    evaluate.mockRejectedValue(
      new Error("TypeSafe API error 401: invalid key"),
    );
    const res = await ask(post({ puzzleId: "umigame", question: "質問？" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "判定に失敗しました" });
  });
});

describe("POST /api/solve", () => {
  const solutionAnswers = (kp: number, consistent: number) => ({
    answers: {
      kp0: bool(kp),
      kp1: bool(kp),
      kp2: bool(0.9),
      consistent: bool(consistent),
    },
    latencyMs: 1,
  });

  it("正解なら truth を返す", async () => {
    evaluate.mockResolvedValue(solutionAnswers(0.9, 0.9));
    const res = await solve(post({ puzzleId: "umigame", answer: "回答" }));
    expect(await res.json()).toEqual({
      solved: true,
      matched: 3,
      total: 3,
      truth,
    });
  });

  it("不正解なら truth を含めない", async () => {
    evaluate.mockResolvedValue(solutionAnswers(0.1, 0.9));
    const body = await (
      await solve(post({ puzzleId: "umigame", answer: "回答" }))
    ).json();
    expect(body).toEqual({ solved: false, matched: 1, total: 3 });
    expect(body).not.toHaveProperty("truth");
  });

  it("要点がそろっても矛盾があれば不正解", async () => {
    evaluate.mockResolvedValue(solutionAnswers(0.9, 0.1));
    expect(
      await (await solve(post({ puzzleId: "umigame", answer: "回答" }))).json(),
    ).toEqual({
      solved: false,
      matched: 3,
      total: 3,
    });
  });

  it("500 文字を超える回答は 400、存在しない問題は 404", async () => {
    expect(
      (await solve(post({ puzzleId: "umigame", answer: "あ".repeat(501) })))
        .status,
    ).toBe(400);
    expect(
      (await solve(post({ puzzleId: "nope", answer: "回答" }))).status,
    ).toBe(404);
  });

  it("混雑は 503、それ以外は 500", async () => {
    evaluate.mockRejectedValueOnce(new JevUnavailableError("busy"));
    expect(
      (await solve(post({ puzzleId: "umigame", answer: "回答" }))).status,
    ).toBe(503);
    evaluate.mockRejectedValueOnce(new Error("boom"));
    expect(
      (await solve(post({ puzzleId: "umigame", answer: "回答" }))).status,
    ).toBe(500);
  });
});

describe("POST /api/reveal", () => {
  it("真相を返す", async () => {
    expect(await (await reveal(post({ puzzleId: "umigame" }))).json()).toEqual({
      truth,
    });
  });

  it("存在しない問題は 404", async () => {
    expect((await reveal(post({ puzzleId: "nope" }))).status).toBe(404);
    expect((await reveal(post({}))).status).toBe(404);
  });
});

describe("POST /api/hint", () => {
  it("指定した番号のヒントだけを返す", async () => {
    const { hints } = getPuzzle("umigame")!;
    for (const [index, text] of hints.entries()) {
      expect(
        await (await hint(post({ puzzleId: "umigame", index }))).json(),
      ).toEqual({ hint: text });
    }
  });

  it("番号が範囲外か整数でなければ 400、存在しない問題は 404", async () => {
    const count = getPuzzle("umigame")!.hints.length;
    for (const index of [-1, count, 0.5, "0", undefined]) {
      expect((await hint(post({ puzzleId: "umigame", index }))).status).toBe(
        400,
      );
    }
    expect((await hint(post({ puzzleId: "nope", index: 0 }))).status).toBe(404);
  });
});

describe("GET /api/puzzles に渡す PublicPuzzle", () => {
  it("ヒントは数だけで、本文を含まない", () => {
    const umigame = listPublicPuzzles().find((p) => p.id === "umigame")!;
    expect(umigame).not.toHaveProperty("hints");
    expect(umigame.hintCount).toBe(getPuzzle("umigame")!.hints.length);
  });
});

describe("/api/likes", () => {
  beforeEach(() => {
    likeStore = new MemoryLikeStore();
  });

  it("GET は全問題の数を返す（まだ押されていない問題は 0）", async () => {
    await postLike(post({ puzzleId: "umigame", liked: true }));
    const res = await getLikes();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const { counts } = await res.json();
    expect(Object.keys(counts).sort()).toEqual(
      listPublicPuzzles()
        .map((p) => p.id)
        .sort(),
    );
    expect(counts.umigame).toBe(1);
    expect(counts.bar).toBe(0);
  });

  it("POST で押すと増え、取り消すと減る。0 未満にはならない", async () => {
    const like = async (liked: boolean) =>
      (await (await postLike(post({ puzzleId: "umigame", liked }))).json())
        .count;
    expect(await like(true)).toBe(1);
    expect(await like(true)).toBe(2);
    expect(await like(false)).toBe(1);
    expect(await like(false)).toBe(0);
    expect(await like(false)).toBe(0);
  });

  it("liked が真偽値でなければ 400、存在しない問題は 404", async () => {
    expect(
      (await postLike(post({ puzzleId: "umigame", liked: "true" }))).status,
    ).toBe(400);
    expect((await postLike(post({ puzzleId: "umigame" }))).status).toBe(400);
    expect(
      (await postLike(post({ puzzleId: "nope", liked: true }))).status,
    ).toBe(404);
  });

  it("保存先の失敗は 500 で、原因を返さない", async () => {
    likeStore = {
      counts: () => Promise.reject(new Error("redis down")),
      add: () => Promise.reject(new Error("redis down")),
    };
    const res = await postLike(post({ puzzleId: "umigame", liked: true }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "いいねの保存に失敗しました" });
    expect((await getLikes()).status).toBe(500);
  });
});
