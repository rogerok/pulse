import { describe, it } from "@effect/vitest";
import { Effect, TestClock } from "effect";
import { expect, vi } from "vitest";

import { makeDnsCache, makeDnsLookup } from "../src/services/dns.ts";

const batch = vi.fn(
  (hosts: ReadonlyArray<string>): Promise<readonly (readonly [string, string | null])[]> =>
    Promise.resolve(hosts.map((host) => [host, `ip-for-${host}`])),
);

beforeEach(() => vi.clearAllMocks());

describe("DnsCache", () => {
  it.effect("caches lookup results until TTL expires", () =>
    Effect.gen(function* () {
      const lookup = vi.fn((host: string) => Effect.succeed(`ip-for-${host}`));

      const cache = yield* makeDnsCache(lookup);

      yield* Effect.forEach(Array.from({ length: 5 }), () => cache.lookup("a.com"), {
        discard: true,
      });

      expect(lookup).toHaveBeenCalledTimes(1);

      yield* TestClock.adjust("4 minutes");
      expect(yield* cache.lookup("a.com")).toBe("ip-for-a.com");
      expect(lookup).toHaveBeenCalledTimes(1);

      yield* TestClock.adjust("2 minutes");
      expect(yield* cache.lookup("a.com")).toBe("ip-for-a.com");
      expect(lookup).toHaveBeenCalledTimes(2);
    }),
  );

  it.effect("runs lookup again after invalidation", () =>
    Effect.gen(function* () {
      const lookup = vi.fn((host: string) => Effect.succeed(`ip-for-${host}`));
      const cache = yield* makeDnsCache(lookup);

      expect(yield* cache.lookup("a.com")).toBe("ip-for-a.com");
      expect(lookup).toHaveBeenCalledTimes(1);

      yield* cache.invalidate("a.com");

      expect(yield* cache.lookup("a.com")).toBe("ip-for-a.com");
      expect(lookup).toHaveBeenCalledTimes(2);
    }),
  );
});

describe("DnsLookup batching", () => {
  it.effect("batch test", () =>
    Effect.gen(function* () {
      const lookup = makeDnsLookup(batch);
      const hosts = Array.from({ length: 100 }, (_, index) => `host-${index % 10}.test`);

      const result = yield* Effect.forEach(hosts, lookup, {
        batching: true,
        concurrency: "unbounded",
      });

      expect(result).toHaveLength(100);
      expect(result).toEqual(hosts.map((_, index) => `ip-for-host-${index % 10}.test`));
      expect(batch).toHaveBeenCalledTimes(2);
      expect(batch.mock.calls.map(([hosts]) => hosts.length)).toEqual([8, 2]);
    }).pipe(Effect.withRequestCaching(true)),
  );
});
