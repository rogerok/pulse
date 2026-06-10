import { Clock, Effect, Match } from "effect";

import type { ProbeResult } from "./probe.ts";

import { HttpStatusError, NetworkError, type PulseError, TimeoutError } from "./errors.ts";
import { generateEventId, MonitorEvent, ProbeFailure } from "./events.ts";
import { CurrentMonitor } from "./services/monitor.ts";

export const formatAlert = (error: PulseError): string =>
  Match.value(error).pipe(
    Match.tag("NetworkError", (err) => `[network] ${err.url}: host is unavailable`),
    Match.tag(
      "HttpStatusError",
      (err) => `[http] ${err.url}: expected ${err.expected}, got ${err.status}`,
    ),
    Match.tag("BodyContractError", (err) => `[body] ${err.url}: body doesn't match with schema`),
    Match.tag("TimeoutError", (err) => `[timeout] ${err.url}: timeout expired in ${err.timeoutMs}`),
    Match.tag("ConfigParseError", (err) => `[config] ${err.path}: can't parse config`),
    Match.tag("StorageError", () => `[storage]: can't write to disk`),
    Match.exhaustive,
  );

export const recordResult = <R>(
  probeEffect: Effect.Effect<ProbeResult, HttpStatusError | NetworkError | TimeoutError, R>,
): Effect.Effect<MonitorEvent, never, CurrentMonitor | R> =>
  Effect.gen(function* () {
    const current = yield* CurrentMonitor;

    return yield* probeEffect.pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          Effect.gen(function* () {
            const reason: ProbeFailure["reason"] =
              error._tag === "TimeoutError"
                ? "timeout"
                : error._tag === "HttpStatusError"
                  ? "http-status"
                  : "network";

            const at = yield* Clock.currentTimeMillis;
            const eventId = yield* generateEventId;

            return {
              _tag: "ProbeFailure" as const,
              at,
              eventId,
              monitorId: current.id,
              reason,
              url: error.url,
            };
          }),

        onSuccess: (result) =>
          Effect.gen(function* () {
            const at = yield* Clock.currentTimeMillis;
            const eventId = yield* generateEventId;

            return {
              _tag: "ProbeSuccess" as const,
              at,
              elapsedMs: result.elapsedMs,
              eventId,
              monitorId: current.id,
              status: result.status,
              url: result.url,
            };
          }),
      }),
    );
  });
export const divideOrDie = (a: number, b: number): Effect.Effect<number> =>
  b === 0 ? Effect.die(new Error("division by zero is a programmer error")) : Effect.succeed(a / b);
