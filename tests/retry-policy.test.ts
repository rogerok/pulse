import { describe, it } from "@effect/vitest";
import { Clock, Effect, Fiber, TestClock } from "effect";
import { expect } from "vitest";

import { NetworkError } from "../src/errors.ts";
import { retryPolicy } from "../src/retry-policy.ts";

// Без jitter клиенты выполнят ретраи одновременно, т.к. получат одинаковые backoff задержки. Произойдет thundering herd

const makeAction = () => {
  let attempts = 0;

  const action = Effect.suspend(() => {
    attempts += 1;

    return attempts < 5
      ? Effect.fail(new NetworkError({ cause: "fail", url: "http://localhost:8080" }))
      : Effect.succeed("ok");
  });

  return {
    action,
    getAttempts: () => attempts,
  };
};

const makeScenario = (random: number) => {
  const { action, getAttempts } = makeAction();

  return Effect.gen(function* () {
    const startedAt = yield* Clock.currentTimeMillis;

    const value = yield* action.pipe(Effect.retry(retryPolicy));

    const finishedAt = yield* Clock.currentTimeMillis;

    return {
      attempts: getAttempts(),
      elapsedMs: finishedAt - startedAt,
      value,
    };
  }).pipe(Effect.withRandomFixed([random]));
};

const run = (random: number) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(makeScenario(random));

    yield* Effect.yieldNow();
    yield* TestClock.adjust("2 seconds");

    return yield* Fiber.join(fiber);
  });

describe("retryPolicy", () => {
  it.effect("эффект падает первые 4 раза и успевает на пятый", () =>
    Effect.gen(function* () {
      const minJitter = yield* run(0);

      expect(minJitter).toEqual({
        attempts: 5,
        elapsedMs: 1_200,
        value: "ok",
      });

      const maximumJitter = yield* run(1);
      expect(maximumJitter).toEqual({
        attempts: 5,
        elapsedMs: 1_800,
        value: "ok",
      });
    }),
  );
});
