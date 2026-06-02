import { Effect } from "effect";

import { decodeFromFile } from "./config.ts";
import { probe } from "./probe.ts";

const program = Effect.gen(function* () {
  const config = yield* decodeFromFile("./src/pulse.config.json");

  for (const monitor of config.monitors) {
    const result = yield* probe(monitor.url);
    yield* Effect.sync(() => {
      console.log(`${monitor.id}: status ${result.status} in ${result.elapsedMs} ms`);
    });
  }
});

Effect.runPromise(program).catch((cause: unknown) => {
  console.error("pulse failed:", cause);
  process.exit(2);
});
