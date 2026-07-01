import { Context, Deferred, Effect, Layer } from "effect";

import { decodeFromFile, PulseConfig } from "../config.ts";
import { ConfigParseError, StorageError } from "../errors.ts";
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
    const deferred = yield* Deferred.make<PulseConfig, ConfigParseError | StorageError>();
    const config = yield* ConfigPath;
    const fs = yield* FsService;

    yield* Effect.fork(
      Deferred.complete(
        deferred,
        decodeFromFile(config.path).pipe(Effect.provideService(FsService, fs)),
      ),
    );

    return {
      getConfig: Deferred.await(deferred),
    };
  }),
}) {}

export const ConfigServiceLive = ConfigService.Default;
