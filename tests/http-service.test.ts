import { Cause, Effect, Exit, Layer } from "effect";

import { HttpService } from "../src/services/http.ts";

const mockResp = { body: "OK", status: 200 };

const HttpMock = Layer.mock(HttpService, {
  _tag: "Pulse/HttpService",
  get: (_url) => Effect.succeed(mockResp),
});

describe("HttpService", () => {
  it("get", async () => {
    const res = await Effect.runPromise(
      Effect.gen(function* () {
        const httpService = yield* HttpService;

        return yield* httpService.get("/");
      }).pipe(Effect.provide(HttpMock)),
    );

    expect(res).toBe(mockResp);
  });

  it("post", async () => {
    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const httpService = yield* HttpService;

        return yield* httpService.post("/", { ok: true });
      }).pipe(Effect.provide(HttpMock), Effect.exit),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      expect(Cause.pretty(exit.cause)).toContain("Unimplemented");
    }
  });
});
