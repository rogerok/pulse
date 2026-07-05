/*
HW-EFF-07-SEMAPHORE-PER-DOMAIN
★★★★
Реализуй DomainLimiter через Ref<HashMap<string, Semaphore>> с лимитом 4 на домен.
Используй Ref.modify для атомарной инициализации semaphore.
Тест: 100 одновременных withDomainSlot('example.com', sleep('100 millis')),
 через лог “fetch start”/“fetch end” проверь, что одновременно работало ровно 4.
 */

import { Effect, HashMap, Ref } from "effect";

export const Limit = 4;

export class DomainLimiter extends Effect.Service<DomainLimiter>()("Pulse/DomainLimiter", {
  effect: Effect.gen(function* () {
    const semaphores = yield* Ref.make(HashMap.empty<string, Effect.Semaphore>());

    const makeSemaphore = (domain: string) =>
      Effect.gen(function* () {
        const next = yield* Effect.makeSemaphore(Limit);

        return yield* Ref.modify(semaphores, (m) => {
          const existing = HashMap.get(m, domain);

          if (existing._tag === "Some") return [existing.value, m];

          return [next, HashMap.set(m, domain, next)];
        });
      });

    const withDomainSlot = <A, E, R>(domain: string, eff: Effect.Effect<A, E, R>) =>
      Effect.gen(function* () {
        const sem = yield* makeSemaphore(domain);
        return yield* sem.withPermits(1)(eff);
      });

    return { withDomainSlot };
  }),
}) {}
