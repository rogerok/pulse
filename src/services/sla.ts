/**
 * Реализуй SlaState-сервис из раздела 8 целиком:
 * TRef<SlaState>, методы recordFailure, recordSuccess, snapshot.
 * Напиши @effect/vitest-тест “три провала подряд переключают URL и сбрасывают счётчик”.
 * Дополнительный тест: 10 параллельных recordFailure атомарно либо все попали в “до переключения”,
 * либо ровно одно из них вызвало переключение, инвариант “если active это fallback,
 * то consecutiveFailures равно 0 на момент переключения” не нарушается.
 */

import { Effect, STM, TRef } from "effect";

export type SlaState = {
  readonly active: "fallback" | "primary";
  readonly consecutiveFailures: number;
};

const FAILURE_THRESHOLD = 3;

export class Sla extends Effect.Service<Sla>()("Pulse/SlaState", {
  effect: Effect.gen(function* () {
    const ref = yield* STM.commit(
      TRef.make<SlaState>({ active: "primary", consecutiveFailures: 0 }),
    );

    const recordFailure = STM.gen(function* () {
      const current = yield* TRef.get(ref);

      const failures = current.consecutiveFailures + 1;

      const next: SlaState =
        failures >= FAILURE_THRESHOLD && current.active === "primary"
          ? {
              active: "fallback",
              consecutiveFailures: 0,
            }
          : { ...current, consecutiveFailures: failures };

      yield* TRef.set(ref, next);
      return next;
    });

    const recordSuccess = STM.gen(function* () {
      const current = yield* TRef.get(ref);

      if (current.consecutiveFailures === 0) return current;

      const next: SlaState = { ...current, consecutiveFailures: 0 };

      yield* TRef.set(ref, next);

      return next;
    });

    const snapshot = TRef.get(ref);

    return {
      recordFailure: STM.commit(recordFailure),
      recordSuccess: STM.commit(recordSuccess),
      snapshot: STM.commit(snapshot),
    };
  }),
}) {}
