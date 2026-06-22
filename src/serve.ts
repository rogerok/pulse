import { HttpLayerRouter, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";

export const makeServeLive = <E, R>(program: Effect.Effect<void, E, R>) => {
  const handler = program.pipe(
    Effect.as(HttpServerResponse.text("ok")),
    Effect.catchAll(() => Effect.succeed(HttpServerResponse.text("err", { status: 500 }))),
  );

  const RouteLive = HttpLayerRouter.add("GET", "/", handler);
  return HttpLayerRouter.serve(RouteLive);
};

export const isServe = (): boolean => process.argv[2] === "serve";
