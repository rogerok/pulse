import { Effect } from "effect";

import { probeSync } from "./probe-sync.ts";

const program = Effect.gen(function* () {
  const result = yield* probeSync("test url");
  yield* Effect.sync(() => {
    console.log(`Sync program.status ${result.status} in ${result.elapsedMs} ms`);
  });
});

Effect.runSync(program);
