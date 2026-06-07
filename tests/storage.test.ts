import { Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect } from "vitest";

import { MonitorId } from "../src/config.ts";
import { MonitorEvent } from "../src/events.ts";
import { FsService } from "../src/services/fs.ts";
import {
  Storage,
  StorageConfig,
  StorageInMemoryLive,
  StorageLive,
} from "../src/services/storage.ts";

describe("StorageInMemoryLive", () => {
  it("returns appended events from readAll", async () => {
    const event: MonitorEvent = {
      _tag: "ProbeSuccess",
      at: 1_700_000_000_000,
      elapsedMs: 42,
      monitorId: MonitorId.make("github-www"),
      status: 200,
      url: "https://github.com",
    };

    const events = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* Storage;

        yield* storage.append(event);

        return yield* storage.readAll();
      }).pipe(Effect.provide(StorageInMemoryLive)),
    );

    expect(events).toEqual([event]);
  });

  it("returns snapshot of events at the moment", async () => {
    const firstEvent: MonitorEvent = {
      _tag: "MonitorPaused",
      at: 1_700_000_000_000,
      monitorId: MonitorId.make("github-www"),
    };

    const secondEvent: MonitorEvent = {
      _tag: "MonitorResumed",
      at: 1_700_000_000_001,
      monitorId: MonitorId.make("github-www"),
    };

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* Storage;

        yield* storage.append(firstEvent);

        const beforeSecondAppend = yield* storage.readAll();

        yield* storage.append(secondEvent);

        const afterSecondAppend = yield* storage.readAll();

        return {
          afterSecondAppend,
          beforeSecondAppend,
        };
      }).pipe(Effect.provide(StorageInMemoryLive)),
    );

    expect(result.beforeSecondAppend).toEqual([firstEvent]);
    expect(result.afterSecondAppend).toEqual([firstEvent, secondEvent]);
  });
});

describe("StorageLive", () => {
  it("closes opened handle when runtime is disposed", async () => {
    let closed = false;
    const lines: string[] = [];
    const event: MonitorEvent = {
      _tag: "MonitorPaused",
      at: 1_700_000_000_000,
      monitorId: MonitorId.make("github-www"),
    };

    const FsMock = Layer.succeed(
      FsService,
      FsService.make({
        append: (_path) =>
          Effect.succeed({
            close: () => Effect.sync(() => (closed = true)),
            write: (line) => Effect.sync(() => lines.push(line)),
          }),
        readText: (_path) => Effect.succeed(lines.join("")),
      }),
    );

    const StorageConfigMock = Layer.succeed(StorageConfig, {
      path: "test-path.jsonl",
    });

    const TestLive = StorageLive.pipe(Layer.provide(Layer.mergeAll(FsMock, StorageConfigMock)));

    const runtime = ManagedRuntime.make(TestLive);

    expect(closed).toBe(false);

    await runtime.runPromise(
      Effect.gen(function* () {
        const storage = yield* Storage;
        yield* storage.append(event);
      }),
    );

    expect(closed).toBe(false);

    await runtime.dispose();

    expect(closed).toBe(true);
    expect(lines).toEqual([`${JSON.stringify(event)}\n`]);
  });

  it("writes events as JSONL and reads them back", async () => {
    const lines: string[] = [];
    const firstEvent: MonitorEvent = {
      _tag: "MonitorPaused",
      at: 1_700_000_000_000,
      monitorId: MonitorId.make("github-www"),
    };

    const secondEvent: MonitorEvent = {
      _tag: "MonitorResumed",
      at: 1_700_000_000_001,
      monitorId: MonitorId.make("github-www"),
    };

    const FsMock = Layer.succeed(
      FsService,
      FsService.make({
        append: (_path) =>
          Effect.succeed({
            close: () => Effect.void,
            write: (line) => Effect.sync(() => lines.push(line)),
          }),

        readText: (_path) => Effect.sync(() => lines.join("")),
      }),
    );

    const StorageConfigMock = Layer.succeed(StorageConfig, {
      path: "test-path.jsonl",
    });

    const TestLive = StorageLive.pipe(Layer.provide(Layer.mergeAll(FsMock, StorageConfigMock)));

    const events = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* Storage;

        yield* storage.append(firstEvent);
        yield* storage.append(secondEvent);

        return yield* storage.readAll();
      }).pipe(Effect.provide(TestLive)),
    );

    expect(events).toEqual([firstEvent, secondEvent]);
    expect(lines).toEqual([`${JSON.stringify(firstEvent)}\n`, `${JSON.stringify(secondEvent)}\n`]);
  });
});
