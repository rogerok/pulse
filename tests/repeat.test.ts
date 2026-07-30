import { describe, it } from "@effect/vitest";
import { Effect, Fiber, Ref, Schema, TestClock } from "effect";
import { expect } from "vitest";

import { Monitor } from "../src/config.ts";
import { probeAll } from "../src/probe/repeat.ts";

// spaced - пауза между завершением предыдущего и стартом следующего
//  fixed - пауза между стартами

const targets = Schema.decodeUnknownSync(Schema.Array(Monitor))([
  {
    fallbackUrl: "https://b.example.test",
    id: "target-a",
    interval: "1m",
    url: "https://a.example.test",
  },
  {
    fallbackUrl: "https://a.example.test",
    id: "target-b",
    interval: "1m",
    url: "https://b.example.test",
  },
]);

describe("probeAll", () => {
  it.effect("запускает каждый target 11 раз за 10 минут", () =>
    Effect.gen(function* () {
      const counts = yield* Ref.make<Record<string, number>>({});

      const probeOne = (target: (typeof targets)[number]) =>
        Ref.update(counts, (current) => ({
          ...current,
          [target.id]: (current[target.id] ?? 0) + 1,
        }));

      const fiber = yield* Effect.fork(probeAll(targets, probeOne));

      yield* Effect.yieldNow();
      yield* TestClock.adjust("10 minutes");

      const result = yield* Ref.get(counts);

      yield* Fiber.interrupt(fiber);

      expect(result).toEqual({
        "target-a": 11,
        "target-b": 11,
      });
    }),
  );
});
