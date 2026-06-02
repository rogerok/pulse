import { Effect } from "effect";

import { decodeFromFile } from "./config.ts";
import { formatAlert, recordResult } from "./matching.ts";
import { probe } from "./probe.ts";

const program = Effect.gen(function* () {
  const config = yield* decodeFromFile("./src/pulse.config.json");

  for (const monitor of config.monitors) {
    const result = yield* probe(monitor.url);
    const event = yield* recordResult(monitor.id, probe(monitor.url));
    yield* Effect.sync(() => {
      if (event._tag === "ProbeSuccess") {
        console.log(`${monitor.id}: status ${result.status} in ${result.elapsedMs} ms`);
      } else if (event._tag === "ProbeFailure") {
        console.warn(`${event.monitorId}: ${event.reason}`);
      }
    });
  }
});

Effect.runPromise(
  program.pipe(
    Effect.catchAll((e) =>
      Effect.sync(() => {
        console.error(formatAlert(e));
        process.exit(2);
      }),
    ),
  ),
);
