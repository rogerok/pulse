import { Effect } from "effect";

import type { ProbeResult } from "../../probe/probe.ts";

import { NetworkError } from "../../errors.ts";

export const probeSync = (url: string): Effect.Effect<ProbeResult, NetworkError> =>
  Effect.gen(function* () {
    const startedAt = yield* Effect.sync(() => Date.now());
    const status = yield* Effect.succeed(200);
    const elapsedMs = yield* Effect.sync(() => Date.now() - startedAt);
    return { elapsedMs, status, url };
  });
