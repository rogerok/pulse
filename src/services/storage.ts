import { Context, Effect, Layer, Schema } from "effect";

import { StorageError } from "../errors.ts";
import { MonitorEvent } from "../events.ts";
import { FsService } from "./fs.ts";

export class StorageConfig extends Context.Tag("Pulse/StorageConfig")<
  StorageConfig,
  {
    readonly path: string;
  }
>() {}

export const StorageConfigLive = Layer.succeed(StorageConfig, {
  path: "events.jsonl",
});

export class Storage extends Context.Tag("Pulse/Storage")<
  Storage,
  {
    readonly append: (e: MonitorEvent) => Effect.Effect<void, StorageError>;
    readonly readAll: () => Effect.Effect<ReadonlyArray<MonitorEvent>, StorageError>;
  }
>() {}

export const StorageLive = Layer.scoped(
  Storage,
  Effect.gen(function* () {
    const fsService = yield* FsService;
    const config = yield* StorageConfig;

    const handle = yield* Effect.acquireRelease(fsService.append(config.path), (handle) =>
      handle.close().pipe(Effect.orDie),
    );

    return {
      append: (e: MonitorEvent) =>
        Effect.gen(function* () {
          yield* handle.write(JSON.stringify(e) + "\n");
        }),
      readAll: () =>
        Effect.gen(function* () {
          const text = yield* fsService.readText(config.path);
          const lines = text.split(/\n/).filter((line) => !!line.trim());

          return yield* Effect.forEach(lines, (line) =>
            Schema.decodeUnknown(Schema.parseJson(MonitorEvent))(line),
          ).pipe(Effect.mapError((cause) => new StorageError({ cause })));
        }),
    };
  }),
);

export const StorageInMemoryLive = Layer.effect(
  Storage,
  Effect.sync(() => {
    const buffer: MonitorEvent[] = [];

    return {
      append: (e: MonitorEvent) => Effect.sync(() => void buffer.push(e)),
      readAll: () => Effect.sync(() => buffer.slice()),
    };
  }),
);
