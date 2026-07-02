import { Effect } from "effect";

import { recordResult } from "./matching.ts";
import { probe } from "./probe.ts";
import { ConfigService } from "./services/config.ts";
import { CurrentMonitor } from "./services/monitor.ts";
import { Storage } from "./services/storage.ts";

export const program = Effect.gen(function* () {
  const configService = yield* ConfigService;
  const config = yield* configService.getConfig;
  const monitors = config.monitors;

  yield* Effect.forEach(
    monitors,
    (m) =>
      Effect.gen(function* () {
        const event = yield* recordResult(probe(m.url));

        const storage = yield* Storage;

        yield* storage.append(event);

        yield* Effect.gen(function* () {
          if (event._tag === "ProbeSuccess") {
            yield* Effect.log(
              `${event.monitorId}: status ${event.status} in ${event.elapsedMs} ms`,
            );
          } else if (event._tag === "ProbeFailure") {
            yield* Effect.logError(`${event.monitorId}: ${event.reason}`);
          }
        });
      }).pipe(CurrentMonitor.provide(m)),
    { concurrency: 2 },
  );
});
