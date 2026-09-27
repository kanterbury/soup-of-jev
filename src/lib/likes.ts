import { Redis } from "@upstash/redis";

/**
 * 問題ごとのいいねの数（設計書 D8）。保存するのは匿名の数だけ。
 * 本番は Upstash Redis、環境変数がないときはメモリで数える（開発・テスト用。再起動で消える）。
 */
export interface LikeStore {
  /** 指定した問題の数。まだ押されていない問題は 0 */
  counts(puzzleIds: string[]): Promise<Record<string, number>>;
  /** 数を 1 増やすか減らし、変えた後の数を返す。0 未満にはしない */
  add(puzzleId: string, delta: 1 | -1): Promise<number>;
}

const HASH_KEY = "soup-of-jev:likes";

export class RedisLikeStore implements LikeStore {
  constructor(private readonly redis: Redis) {}

  async counts(puzzleIds: string[]) {
    const all =
      (await this.redis.hgetall<Record<string, unknown>>(HASH_KEY)) ?? {};
    return Object.fromEntries(
      puzzleIds.map((id) => [id, Math.max(0, Number(all[id]) || 0)]),
    );
  }

  async add(puzzleId: string, delta: 1 | -1) {
    const count = await this.redis.hincrby(HASH_KEY, puzzleId, delta);
    if (count >= 0) return count;
    // 取り消しが重なって負になったら 0 に戻す
    await this.redis.hset(HASH_KEY, { [puzzleId]: 0 });
    return 0;
  }
}

export class MemoryLikeStore implements LikeStore {
  private readonly values = new Map<string, number>();

  async counts(puzzleIds: string[]) {
    return Object.fromEntries(
      puzzleIds.map((id) => [id, this.values.get(id) ?? 0]),
    );
  }

  async add(puzzleId: string, delta: 1 | -1) {
    const count = Math.max(0, (this.values.get(puzzleId) ?? 0) + delta);
    this.values.set(puzzleId, count);
    return count;
  }
}

let store: LikeStore | undefined;

/**
 * 保存先を返す。Vercel Marketplace で Upstash Redis を追加すると入る KV_REST_API_*、
 * または Upstash の UPSTASH_REDIS_REST_* があれば Redis を使う。
 */
export function getLikeStore(): LikeStore {
  if (store) return store;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    store = new RedisLikeStore(new Redis({ url, token }));
  } else {
    console.warn(
      "いいねの保存先（KV_REST_API_URL / KV_REST_API_TOKEN）がないので、メモリで数えます",
    );
    store = new MemoryLikeStore();
  }
  return store;
}
