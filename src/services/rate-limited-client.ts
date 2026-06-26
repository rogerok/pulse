import { Context, Effect } from "effect";

import { HttpService } from "./http.ts";

export class RateLimitedClientConfig extends Context.Tag("Pulse/RateLimitedClientConfig")<
  RateLimitedClientConfig,
  {
    readonly semLimit: number;
  }
>() {}

export class RateLimitedClient extends Effect.Service<RateLimitedClient>()(
  "Pulse/RateLimitedClient",
  {
    effect: Effect.gen(function* () {
      const httpService = yield* HttpService;
      const config = yield* RateLimitedClientConfig;
      const httpSem = yield* Effect.makeSemaphore(config.semLimit);

      return {
        get: (url: string, abortSignal?: AbortSignal) =>
          httpSem.withPermits(1)(httpService.get(url, abortSignal)),
      };
    }),
  },
) {}
