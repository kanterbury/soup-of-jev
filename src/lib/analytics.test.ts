import { afterEach, describe, expect, it, vi } from "vitest";

const sendGAEvent = vi.hoisted(() => vi.fn());
vi.mock("@next/third-parties/google", () => ({ sendGAEvent }));

import { track } from "./analytics";

describe("track", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    sendGAEvent.mockClear();
  });

  it("測定 ID がなければ送らない", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
    track({ name: "restart", params: { puzzle_id: "window" } });
    expect(sendGAEvent).not.toHaveBeenCalled();
  });

  it("測定 ID があれば、イベント名と引数をそのまま送る", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
    track({
      name: "puzzle_solved",
      params: { puzzle_id: "window", question_count: 5, attempt_count: 2 },
    });
    expect(sendGAEvent).toHaveBeenCalledWith("event", "puzzle_solved", {
      puzzle_id: "window",
      question_count: 5,
      attempt_count: 2,
    });
  });
});
