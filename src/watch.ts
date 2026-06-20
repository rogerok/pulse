import { Effect } from "effect";

import { MainLive } from "./main.ts";
import { formatAlert } from "./matching.ts";
import { program } from "./program.ts";

export const watch = program.pipe(
  Effect.provide(MainLive),
  Effect.catchAll((e) =>
    Effect.gen(function* () {
      yield* Effect.logError(formatAlert(e));
      process.exitCode = 2;
    }),
  ),
);
