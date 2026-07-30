import { describe, it } from "@effect/vitest";
import { Effect, Layer, ManagedRuntime } from "effect";
import { expect } from "vitest";

import { HttpService } from "../src/services/http.ts";

const makeMainTest = (onConstruct: () => void, onDispose: () => void) =>
  Layer.scoped(
    HttpService,
    Effect.acquireRelease(
      Effect.sync(() => {
        onConstruct();

        return {
          _tag: "Pulse/HttpService",
          get: () =>
            Effect.succeed({
              body: "get",
              status: 200,
            }),
          post: () =>
            Effect.succeed({
              body: "post",
              status: 201,
            }),
        };
      }),
      () => Effect.sync(onDispose),
    ),
  );

const cliProgram = Effect.gen(function* () {
  const http = yield* HttpService;

  return yield* http.get("https://cli.test");
});

const requestProgram = Effect.gen(function* () {
  const http = yield* HttpService;

  return yield* http.post("https://cli.test", {
    test: "request",
  });
});

describe("shared ManagedRuntime", () => {
  it("строит один раз MainTest", async () => {
    let constructed = 0;
    let disposed = 0;

    const MainTest = makeMainTest(
      () => {
        constructed += 1;
      },
      () => {
        disposed += 1;
      },
    );

    const runtime = ManagedRuntime.make(MainTest);

    expect(constructed).toBe(0);
    expect(disposed).toBe(0);

    try {
      const cliResp = await runtime.runPromise(cliProgram);
      const requestResp = await runtime.runPromise(requestProgram);
      expect(cliResp.status).toBe(200);
      expect(requestResp.status).toBe(201);

      expect(constructed).toBe(1);
      expect(disposed).toBe(0);
    } finally {
      await runtime.dispose();
    }

    expect(disposed).toBe(1);
  });
});
