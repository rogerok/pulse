import { Effect, Ref } from "effect";
import { describe } from "vitest";

import { DomainLimiter, Limit } from "./semaphore-per-domain.ts";

describe("semaphore per domain", () => {
  it("check counters", async () => {
    const max = Limit;
    const total = 100;

    const counters = Effect.gen(function* () {
      return {
        active: yield* Ref.make(0),
        ended: yield* Ref.make(0),
        maxActive: yield* Ref.make(0),
        started: yield* Ref.make(0),
      };
    });

    const program = Effect.gen(function* () {
      const domainLimiter = yield* DomainLimiter;
      const withDomainSlot = domainLimiter.withDomainSlot;
      const c = yield* counters;

      const eff = Effect.gen(function* () {
        const active = yield* Ref.updateAndGet(c.active, (n) => n + 1);

        yield* Ref.update(c.started, (n) => n + 1);

        yield* Ref.update(c.maxActive, (n) => Math.max(n, active));

        yield* Effect.sleep("10 millis");

        yield* Ref.update(c.active, (n) => n - 1);
        yield* Ref.update(c.ended, (n) => n + 1);
      });

      yield* Effect.forEach(
        Array.from({ length: total }, (_, i) => i + 1),
        () => withDomainSlot("example.com", eff),
        { concurrency: "unbounded" },
      );

      const active = yield* Ref.get(c.active);
      const maxActive = yield* Ref.get(c.maxActive);
      const started = yield* Ref.get(c.started);
      const ended = yield* Ref.get(c.ended);

      return {
        active,
        ended,
        maxActive,
        started,
      };
    }).pipe(Effect.provide(DomainLimiter.Default));

    const { active, ended, maxActive, started } = await Effect.runPromise(program);

    expect(active).toBe(0);
    expect(maxActive).toBe(max);
    expect(started).toBe(total);
    expect(ended).toBe(total);
  });
});
