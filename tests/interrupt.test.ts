import { Deferred, Effect, Fiber, Layer, Schema, TestClock, TestContext } from "effect";
import { describe } from "vitest";

import { PulseConfig } from "../src/config.ts";
import { program } from "../src/program.ts";
import { Bootstrap } from "../src/services/bootstrap.ts";
import { ConfigService } from "../src/services/config.ts";
import { DomainLimiter } from "../src/services/domain-limiter.ts";
import { HttpService } from "../src/services/http.ts";
import { MonitorEvents } from "../src/services/monitor-events.ts";
import { ProbeQueue } from "../src/services/probe-queue.ts";
import { Storage, StorageInMemoryLive } from "../src/services/storage.ts";

export const mockResp = { body: "OK", status: 200 };
const mockConfig = Schema.decodeUnknownSync(PulseConfig)({
  monitors: [
    {
      id: "github-www",
      interval: "30s",
      url: "https://github.com",
    },
  ],
});

const shutdown = (p: typeof program, signal: Effect.Effect<void>) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(p);
    yield* signal;

    yield* Fiber.interrupt(fiber);
  });

describe("interrupt hw", () => {
  it("does not append ProbeSuccess after interruption", async () => {
    const p = Effect.gen(function* () {
      const probeStarted = yield* Deferred.make();
      const sigterm = yield* Deferred.make();

      const HttpMock = Layer.mock(HttpService, {
        _tag: "Pulse/HttpService",
        get: () =>
          Effect.gen(function* () {
            yield* Deferred.succeed(probeStarted, undefined);

            yield* Effect.sleep(100);

            return yield* Effect.succeed(mockResp);
          }),
      });

      const ConfigMock = Layer.mock(ConfigService, {
        _tag: "Pulse/ConfigService",
        getConfig: Effect.succeed(mockConfig),
      });
      const BootstrapLive = Bootstrap.Default.pipe(Layer.provide(ConfigMock));

      yield* Effect.gen(function* () {
        const fiber = yield* Effect.fork(shutdown(program, Deferred.await(sigterm)));

        yield* Deferred.await(probeStarted);
        yield* Deferred.succeed(sigterm, undefined);
        yield* Fiber.join(fiber);

        yield* TestClock.adjust(100);

        const storage = yield* Storage;
        const events = yield* storage.readAll();

        expect(events.every((v) => v._tag !== "ProbeSuccess")).toBe(true);
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            StorageInMemoryLive,
            HttpMock,
            ConfigMock,
            BootstrapLive,
            ProbeQueue.Default,
            MonitorEvents.Default,
            DomainLimiter.Default,
          ),
        ),
      );
    });

    await Effect.runPromise(p.pipe(Effect.provide(TestContext.TestContext)));
  });
});
