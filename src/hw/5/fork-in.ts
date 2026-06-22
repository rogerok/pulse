/*
HW-EFF-05-FORK-IN
★★★★
Реализуй heartbeat-фибер
через Effect.forkIn в явный scope,
 а не через Effect.forkScoped.
 Покажи, что Effect.forkScoped
 это сахар над Effect.scope плюс Effect.forkIn,
  написав свою версию forkScoped.
 */

import { Effect, Exit, Schedule, Scope } from "effect";

const forkScoped = <A, E, R>(self: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const scope = yield* Effect.scope;

    return yield* Effect.forkIn(self, scope);
  });

const heartbeat = Effect.gen(function* () {
  yield* Effect.log("tick").pipe(Effect.repeat({ schedule: Schedule.spaced("1 second") }));
}).pipe(Effect.onInterrupt((interruptors) => Effect.log(`interrupted by ${[...interruptors]}`)));

const program = Effect.gen(function* () {
  const scope = yield* Scope.make();

  yield* Effect.forkIn(heartbeat, scope);

  yield* Effect.sleep("10 seconds");

  yield* Scope.close(scope, Exit.void);
});

void Effect.runPromise(program);

const programScoped = Effect.gen(function* () {
  yield* forkScoped(heartbeat);

  yield* Effect.sleep("2 seconds");
}).pipe(Effect.scoped);

// void Effect.runPromise(program);
void Effect.runPromise(programScoped);
