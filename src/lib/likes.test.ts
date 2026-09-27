import type { Redis } from "@upstash/redis";
import { describe, expect, it } from "vitest";
import { RedisLikeStore } from "./likes";

/** RedisLikeStore が使うハッシュの命令だけを持つ偽物 */
function fakeRedis() {
  const hash: Record<string, unknown> = {};
  const redis = {
    hgetall: async () => (Object.keys(hash).length ? { ...hash } : null),
    hincrby: async (_key: string, field: string, delta: number) => {
      hash[field] = (Number(hash[field]) || 0) + delta;
      return hash[field] as number;
    },
    hset: async (_key: string, values: Record<string, unknown>) => {
      Object.assign(hash, values);
      return 1;
    },
  };
  return { redis: redis as unknown as Redis, hash };
}

describe("RedisLikeStore", () => {
  it("まだ何もない問題は 0", async () => {
    const store = new RedisLikeStore(fakeRedis().redis);
    expect(await store.counts(["a", "b"])).toEqual({ a: 0, b: 0 });
  });

  it("取り消しが重なって負になったら 0 に戻す", async () => {
    const { redis, hash } = fakeRedis();
    const store = new RedisLikeStore(redis);
    expect(await store.add("a", 1)).toBe(1);
    expect(await store.add("a", -1)).toBe(0);
    expect(await store.add("a", -1)).toBe(0);
    expect(hash.a).toBe(0);
    expect(await store.counts(["a"])).toEqual({ a: 0 });
  });
});
