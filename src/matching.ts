import { Clock, Effect, Match } from "effect";

import { MonitorId } from "./config.ts";
import { HttpStatusError, NetworkError, PulseError, TimeoutError } from "./errors.ts";
import { MonitorEvent, ProbeFailure } from "./events.ts";
import { ProbeResult } from "./probe.ts";

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
  monitorId: MonitorId,
  probeEffect: Effect.Effect<ProbeResult, HttpStatusError | NetworkError | TimeoutError, R>,
): Effect.Effect<MonitorEvent, never, R> =>
  probeEffect.pipe(
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

          return {
            _tag: "ProbeFailure",
            at: at,
            monitorId,
            reason,
            url: error.url,
          };
        }),
      onSuccess: (result) =>
        Effect.gen(function* () {
          const at = yield* Clock.currentTimeMillis;

          return {
            _tag: "ProbeSuccess",
            at,
            elapsedMs: result.elapsedMs,
            monitorId,
            status: result.status,
            url: result.url,
          };
        }),
    }),
  );

export const divideOrDie = (a: number, b: number): Effect.Effect<number> =>
  b === 0 ? Effect.die(new Error("division by zero is a programmer error")) : Effect.succeed(a / b);
