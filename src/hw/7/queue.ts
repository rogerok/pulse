import { DateTime, Effect, Queue, Ref } from "effect";

// Producer кладёт 1000 событий за секунду в Queue.bounded(64) через Effect.forever плюс Effect.delay.
// Consumer обрабатывает 100 в секунду.
// Замерь через лог “offer suspended”/“offer resumed”,
// сколько секунд producer провёл в suspended.
// Затем замени bounded(64) на unbounded() и sliding(64), сравни поведение и счётчики.

type Event = {
  createdAt: number;
  id: number;
};

const program = Effect.gen(function* () {
  const queue = yield* Queue.sliding<Event>(64);
  // const queue = yield* Queue.unbounded<Event>();
  // const queue = yield* Queue.sliding<Event>(64);
  const counter = yield* Ref.make(0);
  const difference = yield* Ref.make(0);

  const producerStep = Effect.gen(function* () {
    const id = yield* Ref.updateAndGet(counter, (n) => n + 1);
    const createdAt = yield* DateTime.now;

    yield* Queue.offer(queue, {
      createdAt: createdAt.epochMillis,
      id,
    });
    const doneAt = yield* DateTime.now;

    const diff = DateTime.distance(createdAt, doneAt);

    if (diff > 5) {
      yield* Ref.update(difference, (n) => n + diff);
    }

    yield* Effect.sleep("1 millis");
  });

  const consumerStep = Effect.gen(function* () {
    yield* Queue.take(queue);
    yield* Effect.sleep("10 millis");
  });

  yield* Effect.fork(producerStep.pipe(Effect.forever));
  yield* Effect.fork(consumerStep.pipe(Effect.forever));

  yield* Effect.sleep("5 seconds");

  const totalSuspendedMs = yield* Ref.get(difference);

  yield* Effect.log(`${totalSuspendedMs} ms`);

  yield* Effect.log("Finished");
});

void Effect.runPromise(program);
