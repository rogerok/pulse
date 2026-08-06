import { Data, Effect, Exit, Fiber } from "effect";

class CustomError extends Data.TaggedError("CustomError")<{
  cause: unknown;
  msg: "something went wrong";
}> {}

const sleep = Effect.gen(function* () {
  yield* Effect.sleep("2 seconds");
  return "done";
});

const sleepWithError = Effect.gen(function* () {
  yield* Effect.sleep("2 seconds");

  return yield* new CustomError({
    cause: "failed",
    msg: "something went wrong",
  });
});

export const programJoin: Effect.Effect<void> = Effect.gen(function* () {
  const fiber = yield* Effect.fork(sleep);
  // дожидаемся результата выполнения sleep
  const result = yield* Fiber.join(fiber);

  yield* Effect.log(result);
});

/* Fiber.join(fiber) приостанавливает текукщий файбер пока forked fiber не завершится, потом отдаёт его результат
 * Если forked fiber упадёт, ошибка попадёт в канал E
 */
export const programJoinWithError: Effect.Effect<void, CustomError> = Effect.gen(function* () {
  const fiber = yield* Effect.fork(sleepWithError);
  const result = yield* Fiber.join(fiber);

  yield* Effect.log(result);
});

export const programAwait: Effect.Effect<void> = Effect.gen(function* () {
  const fiber = yield* Effect.fork(sleep);
  const result = yield* Fiber.await(fiber);

  yield* result.pipe(
    Exit.match({
      onFailure: () => Effect.log(`placeholder, can't be successfully`),
      onSuccess: Effect.log,
    }),
  );
});

/**
 * Fiber.await приостанавливает родителя, но возвращает Exit, канал ошибок не расширяется,
 * т.к. в отличие от Fiber.join ошибка не пробрасывается автоматически
 */

const programAwaitWithError: Effect.Effect<void> = Effect.gen(function* () {
  const fiber = yield* Effect.fork(sleepWithError);
  const result = yield* Fiber.await(fiber);

  yield* result.pipe(
    Exit.match({
      onFailure: (cause) => Effect.log(cause),
      onSuccess: () => Effect.log(`placeholder, can't be successfully`),
    }),
  );
});

// void Effect.runPromise(programJoin);
// void Effect.runPromise(programJoinWithError);
// void Effect.runPromise(programAwait);
void Effect.runPromise(programAwaitWithError);
