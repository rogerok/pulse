import { FileSystem } from "@effect/platform";
import { describe, it } from "@effect/vitest";
import { Effect, Fiber, Layer, TestClock } from "effect";

import { EventId, MonitorId } from "../src/config.ts";
import { ProbeSuccess } from "../src/events.ts";
import { JsonlWriter } from "../src/services/jsonl-writer.ts";
import { MonitorEventStream } from "../src/services/monitor-events-stream.ts";
import { MonitorEvents } from "../src/services/monitor-events.ts";

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
  it.effect("100 events emit", () => {
    const writes: string[] = [];

    const fs = FileSystem.layerNoop({
      writeFile: (_, data) =>
        Effect.sync(() => {
          writes.push(new TextDecoder().decode(data));
        }),
    });

    const EventsLive = MonitorEventStream.Default.pipe(Layer.provideMerge(MonitorEvents.Default));

    const TestLive = JsonlWriter.Default.pipe(Layer.provideMerge(Layer.mergeAll(EventsLive, fs)));

    return Effect.scoped(
      Effect.gen(function* () {
        const writer = yield* JsonlWriter;
        const events = yield* MonitorEvents;

        const fiber = yield* Effect.fork(writer.run);

        yield* Effect.yieldNow();

        const arr = Array.from({ length: 100 }, (_, i) => makeEvent(i));

        yield* Effect.forEach(arr, events.publish);

        yield* TestClock.adjust("100 millis");

        expect(writes).toHaveLength(1);
        expect(writes[0]?.trim().split("\n")).toHaveLength(64);

        yield* TestClock.adjust("1 second");

        expect(writes).toHaveLength(2);
        expect(writes[1]?.trim().split("\n")).toHaveLength(36);

        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(TestLive)),
    );
  });
  it.effect("5 events emit", () => {
    const writes: string[] = [];

    const fs = FileSystem.layerNoop({
      writeFile: (_, data) =>
        Effect.sync(() => {
          writes.push(new TextDecoder().decode(data));
        }),
    });

    const EventsLive = MonitorEventStream.Default.pipe(Layer.provideMerge(MonitorEvents.Default));

    const TestLive = JsonlWriter.Default.pipe(Layer.provideMerge(Layer.mergeAll(EventsLive, fs)));

    return Effect.scoped(
      Effect.gen(function* () {
        const writer = yield* JsonlWriter;
        const events = yield* MonitorEvents;

        const fiber = yield* Effect.fork(writer.run);

        yield* Effect.yieldNow();

        const arr = Array.from({ length: 5 }, (_, i) => makeEvent(i));

        yield* Effect.forEach(arr, events.publish);
        expect(writes).toHaveLength(0);

        yield* TestClock.adjust("1 second");

        expect(writes).toHaveLength(1);
        expect(writes[0]?.trim().split("\n")).toHaveLength(5);

        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(TestLive)),
    );
  });
});
