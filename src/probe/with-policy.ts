import { Clock, Effect, Either } from "effect";

import { Monitor } from "../config.ts";
import { HttpStatusError } from "../errors.ts";
import { generateEventId } from "../events.ts";
import { retryPolicy } from "../retry-policy.ts";
import { MonitorEvents } from "../services/monitor-events.ts";
import { Sla } from "../services/sla.ts";
import { hedgeProbe } from "./hedged.ts";

export const probeWithPolicy = (target: Monitor) =>
  Effect.gen(function* () {
    const sla = yield* Sla;
    const bus = yield* MonitorEvents;

    const state = yield* sla.snapshot;

    const [activeUrl, backupUrl] =
      state.active === "primary"
        ? [target.url, target.fallbackUrl]
        : [target.fallbackUrl, target.url];

    const attempt = hedgeProbe(activeUrl, backupUrl).pipe(
      Effect.flatMap((resp) =>
        resp.status === target.expect.status
          ? Effect.succeed(resp)
          : Effect.fail(
              new HttpStatusError({
                body: resp.body,
                cause: "Wrong status",
                expected: target.expect.status,
                status: resp.status,
                url: target.url,
              }),
            ),
      ),
      Effect.retry(retryPolicy),
    );

    const start = yield* Clock.currentTimeMillis;
    const result = yield* attempt.pipe(Effect.either);
    const eventId = yield* generateEventId;

    if (Either.isRight(result)) {
      const at = yield* Clock.currentTimeMillis;

      yield* sla.recordSuccess;
      yield* bus.publish({
        _tag: "ProbeSuccess",
        at,
        elapsedMs: at - start,
        eventId,
        monitorId: target.id,
        status: result.right.status,
        url: activeUrl,
      });

      return result.right;
    }

    yield* sla.recordFailure;
    const error = result.left;
    const at = yield* Clock.currentTimeMillis;

    yield* bus.publish({
      _tag: "ProbeFailure",
      at,
      eventId,
      monitorId: target.id,
      reason: "timeout",
      url: activeUrl,
    });

    return yield* error;
  });
