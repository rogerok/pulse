import { Deferred, Effect, Fiber, Layer, Ref, Schema } from "effect";
import { describe } from "vitest";

import { PulseConfig } from "../src/config.ts";
import { Bootstrap } from "../src/services/bootstrap.ts";
import { ConfigService } from "../src/services/config.ts";

const mockConfig = Schema.decodeUnknownSync(PulseConfig)({
  monitors: [
    {
      id: "github-www",
      interval: "30s",
      url: "https://github.com",
    },
  ],
});

describe("Bootstrap", () => {
  it("keeps workers waiting until config is loaded", async () => {
    const program = Effect.gen(function* () {
      // Deferred вручную удерживает ConfigService в состоянии загрузки
      // Это даёт тесту контроль над моментом, когда Bootstrap сможет открыть latch.
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      const allowLoad = yield* Deferred.make<void>();
      const journal = yield* Ref.make<Array<string>>([]);

      const ConfigMock = Layer.mock(ConfigService, {
        _tag: "Pulse/ConfigService",
        getConfig: Deferred.await(allowLoad).pipe(Effect.as(mockConfig)),
      });

      const BootstrapTest = Bootstrap.Default.pipe(Layer.provide(ConfigMock));

      yield* Effect.gen(function* () {
        const bootstrap = yield* Bootstrap;

        // Десять worker-fiber-ов стартуют сразу, но первым действием ждут ready.await.
        const fibers = yield* Effect.forEach(
          Array.from({ length: 10 }),
          () =>
            Effect.fork(
              bootstrap.ready.await.pipe(
                Effect.zipRight(Ref.update(journal, (entries) => [...entries, "started"])),
              ),
            ),
          { concurrency: "unbounded" },
        );

        yield* Effect.yieldNow();

        // Пока ConfigMock не завершил getConfig, Bootstrap не вызвал ready.open,
        // поэтому ни один worker не должен был записать "started".
        const beforeOpen = yield* Ref.get(journal);
        expect(beforeOpen).toHaveLength(0);

        // Разрешаем загрузку конфига; init-fiber продолжит работу и откроет latch.
        yield* Deferred.succeed(allowLoad, undefined);
        yield* Effect.forEach(fibers, Fiber.join);

        // После open все ожидавшие fiber-ы проходят через ready.await.
        const afterOpen = yield* Ref.get(journal);
        expect(afterOpen).toHaveLength(10);
        expect(afterOpen.every((entry) => entry === "started")).toBe(true);
      }).pipe(Effect.provide(BootstrapTest));
    });

    await Effect.runPromise(program);
  });
});
