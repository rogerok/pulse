import { Effect } from "effect";

import { type PulseError } from "./errors.ts";
import { formatAlert } from "./matching.ts";

export const makeWatch = <E extends PulseError, R>(program: Effect.Effect<void, E, R>) =>
  program.pipe(
    Effect.catchAll((e) =>
      Effect.gen(function* () {
        yield* Effect.logError(formatAlert(e));
        process.exitCode = 2;
      }),
    ),
  );

export const isWatch = (): boolean => process.argv[2] === "watch";
