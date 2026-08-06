import { Effect } from "effect";

import { TimeoutError } from "../../errors.ts";
import { HttpService } from "../../services/http.ts";
import { MyCache } from "./cache.ts";

export const readCache = (url: string) =>
  Effect.gen(function* () {
    const cache = yield* MyCache;

    return yield* cache.get(url);
  });

export const probeWithFallback = (url: string) =>
  Effect.gen(function* () {
    const http = yield* HttpService;

    return yield* http.get(url).pipe(
      Effect.timeoutFail({
        duration: "5 seconds",
        onTimeout: () =>
          new TimeoutError({
            timeoutMs: 5_000,
            url,
          }),
      }),
      Effect.orElse(() => readCache(url)),
    );
  });
