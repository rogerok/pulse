import { Context, Effect, Layer, Option, Ref, Schema } from "effect";

import { decodeFromFile, Monitor, PulseConfig, Url } from "../config.ts";
import { StorageError } from "../errors.ts";
import { FsService } from "./fs.ts";

export class ConfigPath extends Context.Tag("Pulse/ConfigPath")<
  ConfigPath,
  {
    readonly path: string;
  }
>() {}

export const ConfigPathLive = Layer.succeed(ConfigPath, {
  path: "./pulse.config.json",
});

export class ConfigService extends Effect.Service<ConfigService>()("Pulse/ConfigService", {
  effect: Effect.gen(function* () {
    const path = yield* ConfigPath;
    const fs = yield* FsService;

    const cache = yield* Ref.make<Option.Option<PulseConfig>>(Option.none());

    const mutex = yield* Effect.makeSemaphore(1);

    const loadUnlocked = Effect.gen(function* () {
      const cached = yield* Ref.get(cache);

      if (Option.isSome(cached)) {
        return cached.value;
      }

      const config = yield* decodeFromFile(path.path).pipe(Effect.provideService(FsService, fs));
      yield* Ref.set(cache, Option.some(config));
      return config;
    });

    const load = mutex.withPermits(1)(loadUnlocked);

    const getEncodedText = (config: PulseConfig) =>
      Schema.encode(PulseConfig)(config).pipe(
        Effect.map((encoded) => JSON.stringify(encoded, null, 2)),
      );

    const initialize = (config: PulseConfig) =>
      mutex.withPermits(1)(
        Effect.gen(function* () {
          const text = yield* getEncodedText(config);

          yield* fs.writeText(path.path, text);
          yield* Ref.set(cache, Option.some(config));
        }),
      );

    const addMonitor = (monitor: Monitor) =>
      mutex.withPermits(1)(
        Effect.gen(function* () {
          const config = yield* loadUnlocked;

          const alreadyExists = config.monitors.some((c) => c.id === monitor.id);

          if (alreadyExists) {
            return yield* Effect.fail(
              new StorageError({
                cause: "already-exists",
                message: "Монитор уже существует",
              }),
            );
          }

          const updatedConfig = { ...config, monitors: [...config.monitors, monitor] };
          const text = yield* getEncodedText(updatedConfig);

          yield* fs.writeText(path.path, text);
          yield* Ref.set(cache, Option.some(updatedConfig));
        }),
      );

    const removeMonitor = (url: Url) =>
      mutex.withPermits(1)(
        Effect.gen(function* () {
          const config = yield* loadUnlocked;

          const alreadyExists = config.monitors.some((c) => c.url === url);
          if (!alreadyExists) {
            return yield* Effect.fail(
              new StorageError({
                cause: "not-found",
                message: "Монитор не найден",
              }),
            );
          }

          if (config.monitors.length === 1) {
            return yield* new StorageError({
              cause: "last-item",
              message: "Нельзя удалить последний элемент",
            });
          }

          const predicate = (m: Monitor) => Effect.succeed(m.url !== url);
          const monitors = yield* Effect.filter(config.monitors, predicate);
          const updatedConfig = { ...config, monitors: [...monitors] };
          const text = yield* getEncodedText(updatedConfig);

          yield* fs.writeText(path.path, text);
          yield* Ref.set(cache, Option.some(updatedConfig));
        }),
      );

    return {
      addMonitor,
      initialize,
      load,
      removeMonitor,
    };
  }),
}) {}

export const ConfigServiceLive = ConfigService.Default;
