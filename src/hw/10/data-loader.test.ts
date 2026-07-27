import { describe, it } from "@effect/vitest";
import { Effect, RequestResolver } from "effect";
import { vi } from "vitest";

import { makeUserResolver, UserRequest } from "./data-loader.ts";

const batchUsers = vi.fn((ids: ReadonlyArray<number>) =>
  Promise.resolve(ids.map((id) => ({ id }))),
);

const userResolver = makeUserResolver(batchUsers);
const boundedUserResolver = RequestResolver.batchN(userResolver, 10);

beforeEach(() => vi.clearAllMocks());

describe("data-loader", () => {
  it.effect("один пользователь", () =>
    Effect.gen(function* () {
      const user = yield* Effect.request(UserRequest({ id: 1 }), boundedUserResolver);

      expect(user).toEqual({ id: 1 });
      expect(batchUsers).toHaveBeenCalledOnce();
      expect(batchUsers).toHaveBeenCalledWith([1]);
    }),
  );

  it.effect("батчинг нескольких запросов", () =>
    Effect.gen(function* () {
      const ids = [1, 2, 3];

      const users = yield* Effect.forEach(
        ids,
        (id) => Effect.request(UserRequest({ id }), boundedUserResolver),
        {
          batching: true,
          concurrency: "unbounded",
        },
      );

      expect(users).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(batchUsers).toHaveBeenCalledOnce();
      expect(batchUsers).toHaveBeenCalledWith([1, 2, 3]);
    }),
  );

  it.effect("батчинг 100 запросов в 10", () => {
    // создаем последовательность 0, 1, 2, ..., 29, 0, 1, 2, ..., 29, ...
    const ids = Array.from({ length: 100 }, (_, i) => i % 30);
    const requestUsers = Effect.forEach(
      ids,
      (id) => Effect.request(UserRequest({ id }), boundedUserResolver),
      {
        batching: true,
        concurrency: "unbounded",
      },
    );

    return Effect.gen(function* () {
      const firstUsers = yield* requestUsers;

      expect(firstUsers).toEqual(ids.map((id) => ({ id })));
      expect(batchUsers).toHaveBeenCalledTimes(3);

      for (const [batchIds] of batchUsers.mock.calls) {
        expect(batchIds.length).toBeLessThanOrEqual(10);
      }

      const secondUsers = yield* requestUsers;

      expect(secondUsers).toEqual(firstUsers);

      expect(batchUsers).toHaveBeenCalledTimes(3);
    }).pipe(Effect.withRequestCaching(true));
  });
});
