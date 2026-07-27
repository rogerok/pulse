import { describe, it } from "@effect/vitest";
import { Effect, Option, Ref, Schedule, Stream, TestClock } from "effect";
import { constant } from "effect/Function";

const tokens = Stream.fromIterable("Hello world from Effect").pipe(
  Stream.schedule(Schedule.spaced("50 millis")),
  Stream.map((char) => ({ _tag: "token" as const, content: char })),
);

const heartbeat = Stream.tick("30 seconds").pipe(Stream.map(constant({ _tag: "ping" as const })));

describe("llm task test", () => {
  it.effect("merged streams", () =>
    Effect.gen(function* () {
      const heartbeatStopped = yield* Ref.make(false);

      const merged = Stream.merge(
        tokens,
        heartbeat.pipe(Stream.ensuring(Ref.set(heartbeatStopped, true))),
        {
          haltStrategy: "left",
        },
      );

      const fiber = yield* Effect.fork(Stream.runCollect(merged));
      yield* Effect.yieldNow();

      yield* TestClock.adjust("2 seconds");

      const result = yield* fiber.poll;

      expect(Option.isSome(result)).toBe(true);
      expect(yield* Ref.get(heartbeatStopped)).toBe(true);
    }),
  );
});
