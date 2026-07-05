import { Deferred, Effect, Fiber, Layer, Ref, Schema } from "effect";
import { expect } from "vitest";

import { PulseConfig } from "../src/config.ts";
import { ConfigPath, ConfigService } from "../src/services/config.ts";
import { FsService } from "../src/services/fs.ts";

describe("ConfigService", () => {
  it("makes all waiting fibers receive the same config and loads it once", async () => {
    const encodedConfig = {
      monitors: [
        {
          id: "github-www",
          interval: "30s",
          url: "https://github.com",
        },
      ],
    };

    const mockConfig = Schema.decodeUnknownSync(PulseConfig)(encodedConfig);

    // держим loadConfig в pending состоянии
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    const allowFinish = await Effect.runPromise(Deferred.make<void>());

    // гарантия того, что loadConfig стартовал
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    const loadStarted = await Effect.runPromise(Deferred.make<void>());

    // считаем сколько раз запустилась загрузка
    const calls = await Effect.runPromise(Ref.make(0));

    const FsMock = Layer.succeed(
      FsService,
      FsService.make({
        append: (_path) =>
          Effect.die(new Error("append should not be used in config service test")),

        readText: (_path) =>
          Effect.gen(function* () {
            yield* Ref.update(calls, (n) => n + 1);

            // Сообщаем о старте загрузки
            yield* Deferred.succeed(loadStarted, undefined);

            yield* Deferred.await(allowFinish);

            return JSON.stringify(encodedConfig);
          }),
      }),
    );

    const ConfigPathMock = Layer.succeed(ConfigPath, { path: "test-config.json" });
    const ConfigTestLive = ConfigService.Default.pipe(
      Layer.provide(Layer.mergeAll(FsMock, ConfigPathMock)),
    );

    const program = Effect.gen(function* () {
      const configService = yield* ConfigService;

      // запускаем 10 ожидающих файберов
      const fibers = yield* Effect.forEach(Array.from({ length: 10 }), () =>
        Effect.fork(configService.getConfig),
      );

      yield* Deferred.await(loadStarted);

      const startedCalls = yield* Ref.get(calls);
      // должен быть 1 т.к. загрузка стартует один раз
      expect(startedCalls).toBe(1);

      // отпускаем загрузку
      yield* Deferred.succeed(allowFinish, undefined);

      // берем результат выполнения всех файберов ожидающих getConfig
      const results = yield* Effect.forEach(fibers, Fiber.join);

      expect(results).toHaveLength(10);
      expect(results.every((config) => config === results[0])).toBe(true);
      expect(results[0]).toEqual(mockConfig);
    });

    await Effect.runPromise(program.pipe(Effect.provide(ConfigTestLive)));
  });
});
