import { Context, Effect, Layer } from "effect";
import * as fs from "node:fs/promises";

import { StorageError } from "../errors.ts";
import { MonitorEvent } from "../events.ts";

export class Storage extends Context.Tag("Pulse/Storage")<
  Storage,
  {
    readonly append: (e: MonitorEvent) => Effect.Effect<void, StorageError>;
  }
>() {}

export const StorageLive = Layer.scoped(
  Storage,
  Effect.gen(function* () {
    const handle = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => fs.open("file.jsonl", "a"),
        catch: (cause) => new StorageError({ cause }),
      }),
      (h) => Effect.promise(() => h.close()),
    );

    return {
      append: (e: MonitorEvent) =>
        Effect.tryPromise({
          try: async () => {
            await handle.write(JSON.stringify(e) + "\n");
          },
          catch: (cause) => new StorageError({ cause }),
        }),
    };
  }),
);
