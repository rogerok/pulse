import { Effect } from "effect";

import { TimeoutError } from "../errors.ts";
import { HttpService } from "../services/http.ts";

const probeOne = (url: string) =>
  Effect.gen(function* () {
    const http = yield* HttpService;
    return yield* http.get(url);
  });

export const hedgeProbe = (primaryUrl: string, fallbackUrl: string) =>
  Effect.race(probeOne(primaryUrl), probeOne(fallbackUrl).pipe(Effect.delay("200 millis"))).pipe(
    Effect.timeoutFail({
      duration: "5 seconds",
      onTimeout: () => new TimeoutError({ timeoutMs: 5000, url: primaryUrl }),
    }),
  );
