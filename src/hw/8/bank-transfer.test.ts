import { Effect, Either, Ref, STM, TRef } from "effect";
import { describe } from "vitest";

import { transfer, transferRacy } from "./bank-transfer.ts";

describe("racy bank transfer tests", () => {
  it("breaks non-negative balance invariant with parallel transfers", async () => {
    const program = Effect.gen(function* () {
      const from = yield* Ref.make(100);
      const to = yield* Ref.make(0);

      yield* Effect.forEach(
        Array.from({ length: 100 }, (_, i) => i),
        () => transferRacy(from, to, 10),
        {
          concurrency: "unbounded",
          discard: true,
        },
      );

      const fromBalance = yield* Ref.get(from);
      const toBalance = yield* Ref.get(to);

      return { fromBalance, toBalance };
    });

    const { fromBalance, toBalance } = await Effect.runPromise(program);

    expect(fromBalance).toBeLessThan(0);
    expect(toBalance).toBeGreaterThan(100);
  });
});

describe("transfer test", () => {
  it("should avoid negative balance", async () => {
    const program = Effect.gen(function* () {
      const from = yield* STM.commit(TRef.make(100));
      const to = yield* STM.commit(TRef.make(0));

      const result = yield* Effect.forEach(
        Array.from({ length: 100 }, (_, i) => i),
        () => STM.commit(transfer(from, to, 10)).pipe(Effect.either),
        {
          concurrency: "unbounded",
        },
      );

      const fromBalance = yield* STM.commit(TRef.get(from));
      const toBalance = yield* STM.commit(TRef.get(to));

      return { fromBalance, result, toBalance };
    });

    const { fromBalance, result, toBalance } = await Effect.runPromise(program);

    expect(fromBalance).toBe(0);
    expect(toBalance).toBe(100);
    expect(fromBalance + toBalance).toBe(100);
    expect(result.filter(Either.isRight).length).toBe(10);
    expect(result.filter(Either.isLeft).length).toBe(90);
  });
});
