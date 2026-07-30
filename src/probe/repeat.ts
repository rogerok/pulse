import { Effect, Schedule } from "effect";

import { type Monitor } from "../config.ts";

export const probeAll = <A, E, R>(
  targets: ReadonlyArray<Monitor>,
  probeOne: (target: Monitor) => Effect.Effect<A, E, R>,
) =>
  Effect.forEach(targets, probeOne, {
    concurrency: "unbounded",
  }).pipe(Effect.repeat(Schedule.fixed("1 minute")));
