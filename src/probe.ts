import { Effect } from "effect";

import { NetworkError } from "./errors.ts";

export type ProbeResult = {
  readonly elapsedMs: number;
  readonly status: number;
  readonly url: string;
};

export const probe = (url: string): Effect.Effect<ProbeResult, NetworkError> =>
  Effect.gen(function* () {
    const startedAt = yield* Effect.sync(() => Date.now());
    const response = yield* Effect.tryPromise({
      try: (signal) => fetch(url, { signal }),
      catch: (cause) => new NetworkError({ cause, url }),
    });
    const elapsedMs = yield* Effect.sync(() => Date.now() - startedAt);
    return { elapsedMs, status: response.status, url };
  });
