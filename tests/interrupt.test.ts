import { Deferred, Effect, Fiber, Layer, TestClock, TestContext } from "effect";
import { describe } from "vitest";

import { program } from "../src/program.ts";
import { HttpService } from "../src/services/http.ts";
import { Storage, StorageInMemoryLive } from "../src/services/storage.ts";

export const mockResp = { body: "OK", status: 200 };

const shutdown = (
  p: typeof program,
  signal: Effect.Effect<void>,
): Effect.Effect<void, never, HttpService | Storage> =>
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

      yield* Effect.gen(function* () {
        const fiber = yield* Effect.fork(shutdown(program, Deferred.await(sigterm)));

        yield* Deferred.await(probeStarted);
        yield* Deferred.succeed(sigterm, undefined);
        yield* Fiber.join(fiber);

        yield* TestClock.adjust(100);

        const storage = yield* Storage;
        const events = yield* storage.readAll();

        expect(events.every((v) => v._tag !== "ProbeSuccess")).toBe(true);
      }).pipe(Effect.provide(Layer.mergeAll(StorageInMemoryLive, HttpMock)));
    });

    await Effect.runPromise(p.pipe(Effect.provide(TestContext.TestContext)));
  });
});
