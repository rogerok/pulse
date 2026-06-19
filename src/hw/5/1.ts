import { Effect, Exit, Fiber } from "effect";

const success = Effect.succeed("ok");
const failure = Effect.fail("boom");
const sleep = Effect.sleep("5 seconds");

const demoEnsuring = <A, E>(effect: Effect.Effect<A, E>) =>
  effect.pipe(Effect.ensuring(Effect.log("ensuring")));
const withEnsuringOk = demoEnsuring(success);
const withEnsuringError = demoEnsuring(failure);
const withEnsuringSleep = demoEnsuring(sleep);

const demoOnError = <A, E>(effect: Effect.Effect<A, E>) =>
  effect.pipe(Effect.onError((cause) => Effect.log("onError", cause)));
const withOnError = demoOnError(failure);

const demoOnExit = <A, E>(effect: Effect.Effect<A, E>) =>
  effect.pipe(
    Effect.onExit(
      Exit.match({
        onFailure: (cause) => Effect.log("onFail", cause),
        onSuccess: () => Effect.log("onExit success"),
      }),
    ),
  );

const withOnExitFailure = demoOnExit(failure);

const withInterrupt = Effect.gen(function* () {
  const fiber = yield* sleep.pipe(
    Effect.onInterrupt((interruptors) => Effect.log(`onInterrupt: ${[...interruptors]}`)),
    Effect.fork,
  );

  yield* Effect.sleep("100 millis");

  yield* Fiber.interrupt(fiber);
});

const runDemo = <A, E, R>(label: string, effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    yield* Effect.log(`--- ${label} ---`);
    yield* Effect.ignore(effect);
  });

const program = Effect.all(
  [
    runDemo("ensuring / success", withEnsuringOk),
    runDemo("ensuring / failure", withEnsuringError),
    runDemo("ensuring / sleep", withEnsuringSleep),

    runDemo("onError / failure", withOnError),

    runDemo("onExit / failure", withOnExitFailure),

    runDemo("onInterrupt / sleep interrupted", withInterrupt),
  ],
  { concurrency: 1, discard: true },
);
void Effect.runPromise(program);
