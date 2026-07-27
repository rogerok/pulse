import { describe, it } from "@effect/vitest";
import { Chunk, Deferred, Effect, Fiber, Layer, Ref, Stream, TestClock } from "effect";

import { EventId, MonitorId } from "../src/config.ts";
import { MonitorEvent, ProbeSuccess } from "../src/events.ts";
import { EventsFeed } from "../src/services/events-feed.ts";
import { MonitorEventStream } from "../src/services/monitor-events-stream.ts";
import { MonitorEvents } from "../src/services/monitor-events.ts";

/*
 Pulse: создай EventsFeed через Stream.share(monitorEvents.all, { capacity: 64, replay: 5, idleTimeToLive: '30 seconds' }).
  Сценарий теста:
  (а) consumer 1 подключается, эмитятся 10 событий,
  consumer 1 видит все 10;
  (б) consumer 2 подключается, видит последние 5 (с 6 по 10), плюс новые;
  (в) оба consumer-а отваливаются, через 30 секунд новая подписка стартует с пустого состояния (PubSub был закрыт, история сброшена);
  (г) если новый consumer подключается через 10 секунд,
  он подцепляется к той же работающей подписке.
  Используй TestClock для управления idle-таймером.
 */

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
const makeEvents = (total: number) => Array.from({ length: total }, (_, i) => makeEvent(i + 1));

const MonitorEventsStreamLive = MonitorEventStream.Default.pipe(
  Layer.provideMerge(MonitorEvents.Default),
);

const TestLive = EventsFeed.Default.pipe(Layer.provideMerge(MonitorEventsStreamLive));

describe("EventsFeed", () => {
  const letSubscriberStart = Effect.yieldNow();

  const publishAll = (monitorEvents: MonitorEvents, events: ReadonlyArray<MonitorEvent>) =>
    Effect.forEach(events, (event) =>
      monitorEvents.publish(event).pipe(Effect.zipRight(Effect.yieldNow())),
    );

  const collect = (feed: EventsFeed["feed"], count: number) =>
    Effect.fork(feed.pipe(Stream.take(count), Stream.runCollect));

  it.effect("(а) первый consumer получает все опубликованные события", () =>
    Effect.gen(function* () {
      const eventsFeed = yield* EventsFeed;
      const monitorEvents = yield* MonitorEvents;
      const publishedEvents = makeEvents(10);

      const consumer1 = yield* collect(eventsFeed.feed, publishedEvents.length);
      yield* letSubscriberStart;
      yield* publishAll(monitorEvents, publishedEvents);

      expect(Chunk.toArray(yield* Fiber.join(consumer1))).toEqual(publishedEvents);
    }).pipe(Effect.provide(TestLive), Effect.scoped),
  );

  it.effect("(б) второй consumer получает replay последних пяти событий и новые события", () =>
    Effect.gen(function* () {
      const eventsFeed = yield* EventsFeed;
      const monitorEvents = yield* MonitorEvents;
      const consumer1EventCount = yield* Ref.make(0);
      const firstTenReceived = yield* Deferred.make<undefined>();
      const initialEvents = makeEvents(10);
      const newEvents = [makeEvent(11), makeEvent(12)];

      const consumer1 = yield* Effect.fork(
        eventsFeed.feed.pipe(
          Stream.tap(() =>
            Ref.updateAndGet(consumer1EventCount, (count) => count + 1).pipe(
              Effect.flatMap((count) =>
                count === initialEvents.length
                  ? Deferred.succeed(firstTenReceived, undefined)
                  : Effect.void,
              ),
            ),
          ),
          Stream.take(initialEvents.length + newEvents.length),
          Stream.runCollect,
        ),
      );
      yield* letSubscriberStart;
      yield* publishAll(monitorEvents, initialEvents);
      yield* Deferred.await(firstTenReceived);

      const consumer2 = yield* collect(eventsFeed.feed, 5 + newEvents.length);
      yield* letSubscriberStart;
      yield* publishAll(monitorEvents, newEvents);

      expect(Chunk.toArray(yield* Fiber.join(consumer1))).toEqual([...initialEvents, ...newEvents]);
      expect(Chunk.toArray(yield* Fiber.join(consumer2))).toEqual([
        ...initialEvents.slice(5),
        ...newEvents,
      ]);
    }).pipe(Effect.provide(TestLive), Effect.scoped),
  );

  it.effect("(в) после 30 секунд без consumers replay очищается", () =>
    Effect.gen(function* () {
      const eventsFeed = yield* EventsFeed;
      const monitorEvents = yield* MonitorEvents;
      const initialEvents = makeEvents(10);

      const consumer1 = yield* collect(eventsFeed.feed, initialEvents.length);
      yield* letSubscriberStart;
      yield* publishAll(monitorEvents, initialEvents);
      yield* Fiber.join(consumer1);
      yield* letSubscriberStart;

      yield* TestClock.adjust("30 seconds");
      yield* letSubscriberStart;

      const consumer2 = yield* collect(eventsFeed.feed, 1);
      yield* letSubscriberStart;

      const freshEvent = makeEvent(11);
      yield* publishAll(monitorEvents, [freshEvent]);

      expect(Chunk.toArray(yield* Fiber.join(consumer2))).toEqual([freshEvent]);
    }).pipe(Effect.provide(TestLive), Effect.scoped),
  );

  it.effect("(г) consumer через 10 секунд подключается к прежней подписке", () =>
    Effect.gen(function* () {
      const eventsFeed = yield* EventsFeed;
      const monitorEvents = yield* MonitorEvents;
      const initialEvents = makeEvents(10);

      const consumer1 = yield* collect(eventsFeed.feed, initialEvents.length);
      yield* letSubscriberStart;
      yield* publishAll(monitorEvents, initialEvents);
      yield* Fiber.join(consumer1);
      yield* letSubscriberStart;

      yield* TestClock.adjust("10 seconds");

      const consumer2 = yield* collect(eventsFeed.feed, 5);

      expect(Chunk.toArray(yield* Fiber.join(consumer2))).toEqual(initialEvents.slice(5));
    }).pipe(Effect.provide(TestLive), Effect.scoped),
  );
});
