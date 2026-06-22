import { Effect } from "effect";

import { decodeFromFile } from "./config.ts";
import { recordResult } from "./matching.ts";
import { probe } from "./probe.ts";
import { CurrentMonitor } from "./services/monitor.ts";

export const program = Effect.gen(function* () {
  const config = yield* decodeFromFile("./src/pulse.config.json");

  for (const monitor of config.monitors) {
    yield* Effect.gen(function* () {
      const event = yield* recordResult(probe(monitor.url));

      yield* Effect.sync(() => {
        if (event._tag === "ProbeSuccess") {
          console.log(`${event.monitorId}: status ${event.status} in ${event.elapsedMs} ms`);
        } else if (event._tag === "ProbeFailure") {
          console.warn(`${event.monitorId}: ${event.reason}`);
        }
      });
    }).pipe(CurrentMonitor.provide(monitor));
  }
});
