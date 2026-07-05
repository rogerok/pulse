import { Effect, HashMap, Ref } from "effect";

export const Limit = 4;

export class DomainLimiter extends Effect.Service<DomainLimiter>()("Pulse/DomainLimiter", {
  effect: Effect.gen(function* () {
    // Для каждого домена держим отдельный Semaphore.
    // Так медленный example.com не забирает общий лимит у другого домена.
    const semaphores = yield* Ref.make(HashMap.empty<string, Effect.Semaphore>());

    const makeSemaphore = (domain: string) =>
      Effect.gen(function* () {
        const next = yield* Effect.makeSemaphore(Limit);

        // Ref.modify делает read+write атомарно.
        // Если два fiber-а одновременно впервые увидели один домен,
        // победит уже записанный semaphore, а лишний next просто не будет использован.
        return yield* Ref.modify(semaphores, (m) => {
          const existing = HashMap.get(m, domain);

          if (existing._tag === "Some") return [existing.value, m];

          return [next, HashMap.set(m, domain, next)];
        });
      });

    const withDomainSlot = <A, E, R>(domain: string, eff: Effect.Effect<A, E, R>) =>
      Effect.gen(function* () {
        const sem = yield* makeSemaphore(domain);
        // withPermits(1) приостанавливает fiber, если для домена уже заняты все слоты.
        return yield* sem.withPermits(1)(eff);
      });

    return { withDomainSlot };
  }),
}) {}
