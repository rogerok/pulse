import { Effect } from "effect";

import { ConfigParseError } from "./errors.ts";
import { formatAlert } from "./matching.ts";
import { HttpService } from "./services/http.ts";

export const makeWatch = (program: Effect.Effect<void, ConfigParseError, HttpService>) =>
  program.pipe(
    Effect.catchAll((e) =>
      Effect.gen(function* () {
        yield* Effect.logError(formatAlert(e));
        process.exitCode = 2;
      }),
    ),
  );

export const isWatch = (): boolean => process.argv[2] === "watch";
