import { Effect, Match } from "effect";

import { MonitorId } from "./config.ts";
import { HttpStatusError, NetworkError, PulseError, TimeoutError } from "./errors.ts";
import { MonitorEvent, ProbeFailure } from "./events.ts";
import { ProbeResult } from "./probe.ts";

export const formatAlert = (error: PulseError): string =>
  Match.value(error).pipe(
    Match.tag("NetworkError", (err) => `[network] ${err.url}`),
    Match.tag("TimeoutError", (err) => `[timeout] ${err.url}: timeout ${err.timeoutMs} exceeded`),
    Match.tag(
      "HttpStatusError",
      (err) => `[http] ${err.url}: expected ${err.expected}, received ${err.status}`,
    ),
    Match.tag("ConfigParseError", (err) => `[config] can't parse ${err.path}`),
    Match.tag("StorageError", () => `[storage] can't write`),
    Match.tag("BodyContractError", (err) => `[body] ${err.url}: body doesn't match to schema`),
    Match.exhaustive,
  );

export const recordResult = <R>(
  monitorId: MonitorId,
  probeEffect: Effect.Effect<ProbeResult, HttpStatusError | NetworkError | TimeoutError, R>,
): Effect.Effect<MonitorEvent, never, R> =>
  probeEffect.pipe(
    Effect.matchEffect({
      onFailure: (err) =>
        Effect.sync<ProbeFailure>(() => {
          const reason: ProbeFailure["reason"] =
            err._tag === "TimeoutError"
              ? "timeout"
              : err._tag === "HttpStatusError"
                ? "http-status"
                : "network";

          return {
            _tag: "ProbeFailure",
            at: Date.now(),
            monitorId,
            reason,
            url: err.url,
          };
        }),
      onSuccess: (result) =>
        Effect.sync(() => ({
          _tag: "ProbeSuccess",
          at: Date.now(),
          elapsedMs: result.elapsedMs,
          monitorId,
          status: result.status,
          url: result.url,
        })),
    }),
  );

export const divideOrDie = (a: number, b: number): Effect.Effect<number> =>
  b === 0 ? Effect.die(new Error("division by zero is forbidden")) : Effect.succeed(a / b);
