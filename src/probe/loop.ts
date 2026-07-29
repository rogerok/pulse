import { Duration, Effect, Schedule } from "effect";

import { Monitor } from "../config.ts";
import { probeWithPolicy } from "./with-policy.ts";

export const probeLoop = (target: Monitor) =>
  probeWithPolicy(target).pipe(
    Effect.catchAll(() => Effect.void), // не прерываем цикл
    Effect.repeat(Schedule.fixed(Duration.millis(target.interval))),
  );
