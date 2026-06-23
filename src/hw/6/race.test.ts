import { Effect } from "effect";
import { describe } from "vitest";

describe("race", () => {
  it("should write interrupted", async () => {
    let lost: number | undefined;

    const primary = Effect.sleep(100).pipe(Effect.onInterrupt(() => Effect.sync(() => (lost = 0))));
    const secondary = Effect.sleep(200).pipe(
      Effect.onInterrupt(() => Effect.sync(() => (lost = 1))),
    );

    const program = Effect.race(primary, secondary);

    await Effect.runPromise(program);

    expect(lost).toBe(1);
  });
});
