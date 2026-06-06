import { Context, Effect, Layer } from "effect";

import { StorageError } from "../errors.ts";
import { MonitorEvent } from "../events.ts";
import { FsService } from "./fs.ts";

export class Storage extends Context.Tag("Pulse/Storage")<
  Storage,
  {
    readonly append: (e: MonitorEvent) => Effect.Effect<void, StorageError>;
  }
>() {}

export const StorageLive = Layer.scoped(
  Storage,
  Effect.gen(function* () {
    const fs = yield* FsService;

    const handle = yield* Effect.acquireRelease(fs.append("file.jsonl"), (handle) =>
      handle.close().pipe(Effect.orDie),
    );

    return {
      append: (e: MonitorEvent) =>
        Effect.gen(function* () {
          yield* handle.write(JSON.stringify(e) + "\n");
        }),
    };
  }),
);
