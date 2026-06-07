import { Effect } from "effect";
import { expect } from "vitest";

import { MonitorId } from "../src/config.ts";
import { MonitorEvent } from "../src/events.ts";
import { Storage, StorageInMemoryLive } from "../src/services/storage.ts";

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
