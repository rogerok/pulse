import { Context, Deferred, Effect, Layer, Ref, Schema } from "effect";

import { decodeFromFile, Monitor, PulseConfig, Url } from "../config.ts";
import { ConfigError, StorageError } from "../errors.ts";
import { FsService } from "./fs.ts";

export class ConfigPath extends Context.Tag("Pulse/ConfigPath")<
  ConfigPath,
  {
    readonly path: string;
  }
>() {}

export const ConfigPathLive = Layer.succeed(ConfigPath, {
  path: "./src/pulse.config.json",
});

export class ConfigService extends Effect.Service<ConfigService>()("Pulse/ConfigService", {
  effect: Effect.gen(function* () {
    const deferred = yield* Deferred.make<Ref.Ref<PulseConfig>, ConfigError>();
    const path = yield* ConfigPath;
    const fs = yield* FsService;

    yield* Effect.fork(
      Deferred.complete(
        deferred,
        decodeFromFile(path.path).pipe(
          Effect.provideService(FsService, fs),
          Effect.flatMap(Ref.make),
        ),
      ),
    );

    const getEncodedText = (config: PulseConfig) =>
      Effect.gen(function* () {
        const encoded = yield* Schema.encode(PulseConfig)(config);
        return JSON.stringify(encoded, null, 2);
      });

    const getConfig = Effect.gen(function* () {
      const configRef = yield* Deferred.await(deferred);
      return yield* Ref.get(configRef);
    });

    const addMonitor = (monitor: Monitor) =>
      Effect.gen(function* () {
        const configRef = yield* Deferred.await(deferred);
        const config = yield* getConfig;

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

        yield* fs.writeText(path.path, yield* getEncodedText(updatedConfig));

        yield* Ref.set(configRef, updatedConfig);
      });

    const removeMonitor = (url: Url) =>
      Effect.gen(function* () {
        const configRef = yield* Deferred.await(deferred);
        const config = yield* getConfig;

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

        yield* fs.writeText(path.path, yield* getEncodedText(updatedConfig));

        yield* Ref.set(configRef, updatedConfig);
      });

    return {
      addMonitor,
      getConfig,
      removeMonitor,
    };
  }),
}) {}

export const ConfigServiceLive = ConfigService.Default;
