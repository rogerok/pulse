import { Effect, Exit, Layer, ManagedRuntime } from "effect";
import { expect } from "vitest";

import { EventId, MonitorId } from "../src/config.ts";
import { NetworkError } from "../src/errors.ts";
import { MonitorEvent } from "../src/events.ts";
import { probe } from "../src/probe.ts";
import { FsService } from "../src/services/fs.ts";
import { HttpService } from "../src/services/http.ts";
import { Storage, StorageConfig, StorageLive } from "../src/services/storage.ts";

describe("probe", () => {
  it("probe", async () => {
    let abSignal: AbortSignal | undefined;

    const HttpMock = Layer.mock(HttpService, {
      _tag: "Pulse/HttpService",
      get: (_url, signal) =>
        Effect.gen(function* () {
          abSignal = signal;
          return yield* Effect.fail(new NetworkError({ cause: "", url: "" }));
        }),
    });

    const exit = await Effect.runPromise(
      probe("https://example.com").pipe(Effect.provide(HttpMock), Effect.exit),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(abSignal?.aborted).toBe(true);
  });

  it("probe with parent", async () => {
    let abSignal: AbortSignal | undefined;
    let parentClosed = false;

    const event: MonitorEvent = {
      _tag: "MonitorPaused",
      at: 1_700_000_000_000,
      eventId: EventId.make("1700000000000-5500"),
      monitorId: MonitorId.make("github-www"),
    };
    const HttpMock = Layer.mock(HttpService, {
      _tag: "Pulse/HttpService",
      get: (_url, signal) =>
        Effect.gen(function* () {
          abSignal = signal;
          return yield* Effect.fail(new NetworkError({ cause: "", url: "" }));
        }),
    });

    const FsMock = Layer.mock(FsService, {
      _tag: "Pulse/FsService",
      append: () =>
        Effect.succeed({
          close: () => Effect.sync(() => (parentClosed = true)),
          write: () => Effect.void,
        }),
    });

    const StorageConfigMock = Layer.succeed(StorageConfig, {
      path: "test-path.jsonl",
    });

    const TestLive = StorageLive.pipe(Layer.provide(Layer.mergeAll(FsMock, StorageConfigMock)));

    const runtime = ManagedRuntime.make(Layer.mergeAll(TestLive, HttpMock));

    const exit = await runtime.runPromise(
      Effect.gen(function* () {
        const storage = yield* Storage;
        yield* storage.append(event);

        return yield* probe("http://example.com").pipe(Effect.exit);
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(abSignal?.aborted).toBe(true);

    await runtime.dispose();

    expect(parentClosed).toBe(true);
  });
});
