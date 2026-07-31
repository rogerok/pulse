import { Command } from "@effect/cli";
import { Effect } from "effect";

import { program } from "../../program.ts";
import { makeWatch } from "../../watch.ts";

export const watchCommand = Command.make("watch", {}, () =>
  Effect.gen(function* () {
    yield* makeWatch(program);
  }),
);
