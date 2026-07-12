import { describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { Sla } from "../src/services/sla.ts";

describe("Sla", () => {
  it.effect("switches to fallback after three consecutive failures", () =>
    Effect.gen(function* () {
      const sla = yield* Sla;

      const after1 = yield* sla.recordFailure;
      expect(after1.active).toBe("primary");

      const after2 = yield* sla.recordFailure;
      expect(after2.active).toBe("primary");

      const after3 = yield* sla.recordFailure;
      expect(after3.active).toBe("fallback");
      expect(after3.consecutiveFailures).toBe(0);
    }).pipe(Effect.provide(Sla.Default)),
  );

  it.effect("success resets the counter", () =>
    Effect.gen(function* () {
      const sla = yield* Sla;
      yield* sla.recordFailure;
      yield* sla.recordFailure;
      const afterSuccess = yield* sla.recordSuccess;
      expect(afterSuccess.consecutiveFailures).toBe(0);
      expect(afterSuccess.active).toBe("primary");
    }).pipe(Effect.provide(Sla.Default)),
  );

  it.effect("starts with primary URL and zero failures", () =>
    Effect.gen(function* () {
      const sla = yield* Sla;

      const state = yield* sla.snapshot;

      expect(state.active).toBe("primary");
      expect(state.consecutiveFailures).toBe(0);
    }).pipe(Effect.provide(Sla.Default)),
  );

  it.effect("switches to fallback atomically under concurrent failures", () =>
    Effect.gen(function* () {
      const sla = yield* Sla;

      const res = yield* Effect.all(
        Array.from({ length: 10 }, () => sla.recordFailure),
        { concurrency: "unbounded" },
      );

      const switchResults = res.filter(
        (state) => state.active === "fallback" && state.consecutiveFailures === 0,
      );
      expect(switchResults).toHaveLength(1);
    }).pipe(Effect.provide(Sla.Default)),
  );
});
