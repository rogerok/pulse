import { describe, it } from "@effect/vitest";
import { Effect, Fiber, Layer, TestClock } from "effect";

import { EventId, MonitorId } from "../src/config.ts";
import { MonitorEvent, ProbeSuccess } from "../src/events.ts";
import { JsonlWriter } from "../src/services/jsonl-writer.ts";
import { MonitorEventStream } from "../src/services/monitor-events-stream.ts";
import { MonitorEvents } from "../src/services/monitor-events.ts";
import { Storage } from "../src/services/storage.ts";

const makeEvent = (i: number) =>
  ProbeSuccess.make({
    _tag: "ProbeSuccess",
    at: 1_700_000_000_000,
    elapsedMs: 42,
    eventId: EventId.make(`1-1111`),
    monitorId: MonitorId.make(`aa-${i}`),
    status: 200,
    url: "https://i.com",
  });

describe("jsonl writer", () => {
  const publishAll = (
    events: ReadonlyArray<MonitorEvent>,
    publish: (e: MonitorEvent) => Effect.Effect<void>,
  ) =>
    Effect.gen(function* () {
      yield* Effect.fork(
        Effect.sleep("1 millis").pipe(Effect.zipRight(Effect.forEach(events, publish))),
      );

      yield* TestClock.adjust("1 millis");
    });

  {
    it.effect("100 events emit", () => {
      const batches: Array<ReadonlyArray<MonitorEvent>> = [];
      const storage = Layer.mock(Storage, {
        appendBatch: (events) => Effect.sync(() => void batches.push(events)),
      });

      const EventsLive = MonitorEventStream.Default.pipe(Layer.provideMerge(MonitorEvents.Default));

      const TestLive = JsonlWriter.Default.pipe(
        Layer.provideMerge(Layer.mergeAll(EventsLive, storage)),
      );

      return Effect.scoped(
        Effect.gen(function* () {
          const writer = yield* JsonlWriter;
          const events = yield* MonitorEvents;

          const fiber = yield* Effect.fork(writer.run);

          yield* Effect.yieldNow();

          const arr = Array.from({ length: 100 }, (_, i) => makeEvent(i));

          yield* publishAll(arr, events.publish);

          expect(batches).toHaveLength(1);
          expect(batches[0]).toHaveLength(64);

          yield* TestClock.adjust("1 second");

          expect(batches).toHaveLength(2);
          expect(batches[1]).toHaveLength(36);

          yield* Fiber.interrupt(fiber);
        }).pipe(Effect.provide(TestLive)),
      );
    });
  }
  it.effect("5 events emit", () => {
    const batches: Array<ReadonlyArray<MonitorEvent>> = [];

    const storage = Layer.mock(Storage, {
      appendBatch: (events) => Effect.sync(() => void batches.push(events)),
    });

    const EventsLive = MonitorEventStream.Default.pipe(Layer.provideMerge(MonitorEvents.Default));

    const TestLive = JsonlWriter.Default.pipe(
      Layer.provideMerge(Layer.mergeAll(EventsLive, storage)),
    );

    return Effect.scoped(
      Effect.gen(function* () {
        const writer = yield* JsonlWriter;
        const events = yield* MonitorEvents;

        const fiber = yield* Effect.fork(writer.run);

        yield* Effect.yieldNow();

        const arr = Array.from({ length: 5 }, (_, i) => makeEvent(i));

        yield* publishAll(arr, events.publish);

        expect(batches).toHaveLength(0);

        yield* TestClock.adjust("1 second");

        expect(batches).toHaveLength(1);
        expect(batches[0]).toHaveLength(5);

        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(TestLive)),
    );
  });
});
