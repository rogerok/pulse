import { Effect } from "effect";

import { NetworkError } from "./errors.ts";
import { HttpService } from "./services/http.ts";

export type ProbeResult = {
  readonly elapsedMs: number;
  readonly status: number;
  readonly url: string;
};

export const probe = (url: string): Effect.Effect<ProbeResult, NetworkError, HttpService> =>
  Effect.gen(function* () {
    const httpService = yield* HttpService;

    const startedAt = yield* Effect.sync(() => Date.now());

    const response = yield* httpService.get(url);
    const elapsedMs = yield* Effect.sync(() => Date.now() - startedAt);
    return { elapsedMs, status: response.status, url };
  });
