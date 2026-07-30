import { Data, Effect, Request, RequestResolver } from "effect";

/*
Реализуй ресолвер UserResolver, который батчит до 10 запросов в один HTTP-вызов
POST /users/batch (стаб через vi.fn, который отдаёт Promise.resolve(users.map(...))).
Подними тест: 100 параллельных Effect.request(GetUserById({ id: i % 30 }))
 через forEach({ batching: true, concurrency: 'unbounded' }).
Проверь: стаб HTTP вызвался ровно 3 раза (30 уникальных id, batchN(10) режет на 3 пакета),
и каждый вызов получил массив из 10 (или меньше) id-шек.
Бонус: добавь withRequestCaching(true) и проверь, что повторный forEach в той же программе уже не идёт в HTTP вообще.
 */

export interface User {
  readonly id: number;
}

class UserError extends Data.TaggedError("UserError")<{
  readonly cause: unknown;
}> {}

export interface IUserRequest extends Request.Request<User, UserError> {
  readonly _tag: "UserRequest";
  readonly id: number;
}

export const batchUsers = (ids: User["id"][]) =>
  Effect.tryPromise({
    try: () => Promise.resolve(ids.map((id) => ({ id }))),
    catch: (cause) => new UserError({ cause }),
  });

export const UserRequest = Request.tagged<IUserRequest>("UserRequest");
export type BatchUsers = (ids: ReadonlyArray<User["id"]>) => Promise<ReadonlyArray<User>>;

export const makeUserResolver = (batchUsers: BatchUsers) =>
  RequestResolver.makeBatched((requests: ReadonlyArray<IUserRequest>) =>
    Effect.gen(function* () {
      const ids = requests.map((r) => r.id);
      const result = yield* Effect.tryPromise({
        try: () => batchUsers(ids),
        catch: (cause) => new UserError({ cause }),
      }).pipe(Effect.either);

      if (result._tag === "Left") {
        yield* Effect.forEach(
          requests,
          (req) => Request.completeEffect(req, Effect.fail(result.left)),
          {
            discard: true,
          },
        );
        return;
      }

      yield* Effect.forEach(
        requests,
        (req) => {
          const user = result.right.find((r) => r.id === req.id);
          return Request.completeEffect(
            req,
            user ? Effect.succeed(user) : Effect.fail(new UserError({ cause: "not found" })),
          );
        },
        { discard: true },
      );
    }),
  );
