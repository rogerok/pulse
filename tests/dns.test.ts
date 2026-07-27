import { describe, it } from "@effect/vitest";
import { Effect, TestClock } from "effect";
import { expect, vi } from "vitest";

import { makeDnsCache } from "../src/services/dns.ts";

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
