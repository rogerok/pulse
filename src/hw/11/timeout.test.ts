import { describe, it } from "@effect/vitest";
import { Effect, Cache as EffectCache, Fiber, Layer, TestClock } from "effect";
import { expect, vi } from "vitest";

import { NetworkError } from "../../errors.ts";
import { HttpService } from "../../services/http.ts";
import { type HttpResponse, MyCache, NoCacheError } from "./cache.ts";
import { probeWithFallback } from "./timeout.ts";

const url = "https://test.test";

const fresh: HttpResponse = {
  body: "fresh",
  status: 200,
};

const cached: HttpResponse = {
  body: "cached",
  status: 200,
};

const makeCache = (lookup: (key: string) => Effect.Effect<HttpResponse, NoCacheError>) =>
  EffectCache.make({
    capacity: 16,
    lookup,
    timeToLive: "1 hour",
  });

describe("probeWithFallback", () => {
  it.effect("возвращает ответ, не читает кеш", () =>
    Effect.gen(function* () {
      const lookup = vi.fn((key: string) => Effect.fail(new NoCacheError({ url: key })));

      const cache = yield* makeCache(lookup);

      const CacheLive = Layer.succeed(MyCache, cache);

      const HttpLive = Layer.mock(HttpService, {
        _tag: "Pulse/HttpService",
        get: () => Effect.succeed(fresh),
      });

      const result = yield* probeWithFallback(url).pipe(
        Effect.provide(Layer.mergeAll(HttpLive, CacheLive)),
      );

      expect(result).toEqual(fresh);
      expect(lookup).not.toHaveBeenCalled();
    }),
  );

  it.effect("после timeout возвращает ответ из кеша", () =>
    Effect.gen(function* () {
      const lookup = vi.fn((key: string) => Effect.fail(new NoCacheError({ url: key })));

      const cache = yield* makeCache(lookup);
      yield* cache.set(url, cached);

      const CacheLive = Layer.succeed(MyCache, cache);

      const HttpLive = Layer.mock(HttpService, {
        _tag: "Pulse/HttpService",
        get: () => Effect.never,
      });

      const fiber = yield* Effect.fork(
        probeWithFallback(url).pipe(Effect.provide(Layer.mergeAll(HttpLive, CacheLive))),
      );

      yield* Effect.yieldNow();
      yield* TestClock.adjust("5 seconds");

      const result = yield* Fiber.join(fiber);

      expect(result).toEqual(cached);
      expect(lookup).not.toHaveBeenCalled();
    }),
  );

  it.effect("возвращает NoCacheError, если HTTP упал и кеш пуст", () =>
    Effect.gen(function* () {
      const lookup = vi.fn((key: string) => Effect.fail(new NoCacheError({ url: key })));

      const cached = yield* makeCache(lookup);

      const CacheLive = Layer.succeed(MyCache, cached);

      const HttpLive = Layer.mock(HttpService, {
        _tag: "Pulse/HttpService",
        get: () =>
          Effect.fail(
            new NetworkError({
              cause: "unavailable",
              url,
            }),
          ),
      });

      const error = yield* probeWithFallback(url).pipe(
        Effect.provide(Layer.mergeAll(HttpLive, CacheLive)),
        Effect.flip,
      );

      expect(error).toBeInstanceOf(NoCacheError);
      expect(error.url).toBe(url);
      expect(lookup).toHaveBeenCalledOnce();
    }),
  );
});
