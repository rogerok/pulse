import { Effect } from "effect";
import { describe } from "vitest";

import { IntervalMs, Monitor, MonitorId, Url } from "../src/config.ts";
import { recordResult } from "../src/matching.ts";
import { CurrentMonitor } from "../src/services/monitor.ts";
import { Storage, StorageInMemoryLive } from "../src/services/storage.ts";

describe("CurrentMonitor", () => {
  it("writes events with monitorId", async () => {
    const firstMonitor: Monitor = {
      expect: {
        status: 200,
      },
      fallbackUrl: Url.make("https://github.com"),
      id: MonitorId.make("github"),
      interval: IntervalMs.make(100),
      url: Url.make("https://github.com"),
    };

    const secondMonitor = {
      expect: {
        status: 200,
      },
      id: MonitorId.make("example"),
      interval: IntervalMs.make(200),
      url: Url.make("https://example.com"),
    };

    const program = Effect.gen(function* () {
      const storage = yield* Storage;

      const firstEvent = yield* recordResult(
        Effect.succeed({
          elapsedMs: 10,
          status: 200,
          url: firstMonitor.url,
        }),
      ).pipe(CurrentMonitor.provide(firstMonitor));

      const secondEvent = yield* recordResult(
        Effect.succeed({
          elapsedMs: 20,
          status: 200,
          url: secondMonitor.url,
        }),
      ).pipe(CurrentMonitor.provide(secondMonitor));

      yield* storage.append(firstEvent);
      yield* storage.append(secondEvent);

      return yield* storage.readAll();
    });

    const events = await Effect.runPromise(program.pipe(Effect.provide(StorageInMemoryLive)));

    expect(events).toHaveLength(2);
    expect(events[0]?.monitorId).toBe(firstMonitor.id);
    expect(events[1]?.monitorId).toBe(secondMonitor.id);
  });
});
