import { Effect, Layer } from "effect";

import { HttpService } from "../src/services/http.ts";
import { RateLimitedClient, RateLimitedClientConfig } from "../src/services/rate-limited-client.ts";

describe("RateLimitedClient", () => {
  it(`shouldn't be gtr 3`, async () => {
    let active = 0;
    let maxActive = 0;
    let started = 0;
    let ended = 0;

    const HttpMock = Layer.mock(HttpService, {
      _tag: "Pulse/HttpService",
      get: () =>
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            started += 1;
            active += 1;
            maxActive = Math.max(maxActive, active);
          });
          yield* Effect.log("fetch started", { active });

          yield* Effect.sleep(100);

          yield* Effect.sync(() => {
            active -= 1;
            ended += 1;
          });
          yield* Effect.log("fetch end", { active });

          return { body: "OK", status: 200 };
        }),
    });

    const Config = Layer.succeed(RateLimitedClientConfig, {
      semLimit: 3,
    });

    const Client = RateLimitedClient.Default.pipe(Layer.provide(Layer.mergeAll(HttpMock, Config)));

    const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/${i}`);

    const program = Effect.gen(function* () {
      const client = yield* RateLimitedClient;

      yield* Effect.forEach(urls, (url) => client.get(url), {
        concurrency: "unbounded",
      });
    });

    await Effect.runPromise(program.pipe(Effect.provide(Client)));

    expect(started).toBe(10);
    expect(ended).toBe(10);
    expect(maxActive).toBe(3);
  });
});
