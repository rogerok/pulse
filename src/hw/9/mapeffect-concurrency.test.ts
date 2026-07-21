import { describe, it } from "@effect/vitest";
import { Duration, Effect, Ref, Stream } from "effect";
import { expect } from "vitest";

const processItem = (n: number) =>
  Effect.gen(function* () {
    yield* Effect.sleep("100 millis");
    return n * 2;
  });

const run = (concurrency: "unbounded" | number) =>
  Effect.gen(function* () {
    const activeCounter = yield* Ref.make(0);
    const maxCounter = yield* Ref.make(0);

    const processWithCounter = (n: number) =>
      Effect.gen(function* () {
        const c = yield* Ref.updateAndGet(activeCounter, (c) => c + 1);

        yield* Ref.update(maxCounter, (max) => Math.max(max, c));

        return yield* processItem(n);
      }).pipe(Effect.ensuring(Ref.update(activeCounter, (c) => c - 1)));

    const range = Stream.range(1, 50).pipe(Stream.mapEffect(processWithCounter, { concurrency }));

    const [duration] = yield* range.pipe(Stream.runCollect, Effect.timed);

    const max = yield* Ref.get(maxCounter);

    return { duration: Duration.toMillis(duration), max };
  });

describe("mapeffect-concurrency", () => {
  it.live(
    "concurrency 1",
    () =>
      Effect.gen(function* () {
        const concurrency = 1;
        const { max } = yield* run(concurrency);

        expect(max).toBe(concurrency);
      }),
    7000,
  );

  it.live(
    "concurrency 4",
    () =>
      Effect.gen(function* () {
        const concurrency = 4;

        const { max } = yield* run(concurrency);
        expect(max).toBe(concurrency);
      }),
    7000,
  );

  it.live(
    "expect concurrency 4 time duration is less then concurrency 1 duration",
    () =>
      Effect.gen(function* () {
        const concurrency1 = 1;
        const result1 = yield* run(concurrency1);

        const concurrency4 = 4;
        const result4 = yield* run(concurrency4);

        expect(result4.duration).toBeLessThan(result1.duration);
      }),
    7000,
  );
  it.live(
    "unbounded",
    () =>
      Effect.gen(function* () {
        const unbounded = yield* run("unbounded");

        expect(unbounded.max).toBe(50);
      }),
    7000,
  );
});
