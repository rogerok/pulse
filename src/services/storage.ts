import { Context, Effect, Layer, Ref, Schema } from "effect";

import { FileSystemError } from "../errors.ts";
import { MonitorEvent } from "../events.ts";
import { ConfigService } from "./config.ts";
import { FsService } from "./fs.ts";

const DEFAULT_EVENTS_PATH = "./events.jsonl";

// export class StorageConfig extends Context.Tag("Pulse/StorageConfig")<
//   StorageConfig,
//   {
//     readonly path: string;
//   }
// >() {}

export class StorageConfig extends Effect.Service<StorageConfig>()("Pulse/StorageConfig", {
  effect: Effect.gen(function* () {
    const ref = yield* Ref.make<string>(DEFAULT_EVENTS_PATH);

    const write = (path: string) => Ref.set(ref, path);
    const path = yield* Ref.get(ref);

    return {
      path,
      write,
    };
  }),
}) {}

// export const StorageConfigLive = Layer.succeed(StorageConfig, {
//   path: "events.jsonl",
// });

export class Storage extends Context.Tag("Pulse/Storage")<
  Storage,
  {
    readonly append: (e: MonitorEvent) => Effect.Effect<void, FileSystemError>;
    appendBatch(events: ReadonlyArray<MonitorEvent>): Effect.Effect<void, FileSystemError>;
    readonly readAll: () => Effect.Effect<ReadonlyArray<MonitorEvent>, FileSystemError>;
  }
>() {}

export const StorageLive = Layer.scoped(
  Storage,
  Effect.gen(function* () {
    const fsService = yield* FsService;
    const configService = yield* ConfigService;
    const config = yield* configService.load;
    const path = config.defaults.jsonlPath;

    const handle = yield* Effect.acquireRelease(fsService.append(path), (handle) =>
      handle.close().pipe(Effect.orDie),
    );

    return {
      append: (e: MonitorEvent) =>
        Effect.gen(function* () {
          yield* handle.write(JSON.stringify(e) + "\n");
        }),
      appendBatch: (events) =>
        Effect.gen(function* () {
          yield* handle.write(events.map((e) => JSON.stringify(e)).join("\n") + "\n");
        }),
      readAll: () =>
        Effect.gen(function* () {
          const text = yield* fsService.readText(path);
          const lines = text.split(/\n/).filter((line) => !!line.trim());

          return yield* Effect.forEach(lines, (line) =>
            Schema.decodeUnknown(Schema.parseJson(MonitorEvent))(line),
          ).pipe(Effect.mapError((cause) => new FileSystemError({ cause, path })));
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
      appendBatch: (es) => Effect.sync(() => void buffer.push(...es)),
      readAll: () => Effect.sync(() => buffer.slice()),
    };
  }),
);
