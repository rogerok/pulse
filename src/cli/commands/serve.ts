import { Command, Options } from "@effect/cli";
import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { createServer } from "node:http";

import { PulseApiLive } from "../../api.ts";

const serverLayer = (port: number) =>
  HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
    Layer.provide(PulseApiLive),
    HttpServer.withLogAddress,
    Layer.provide(NodeHttpServer.layer(() => createServer(), { port })),
  );

const port = Options.integer("port").pipe(Options.withDefault(8080));

export const serveCommand = Command.make("serve", { port }, ({ port }) =>
  Effect.gen(function* () {
    yield* Effect.log(`pulse слушает на :${port}`);

    return yield* Layer.launch(serverLayer(port));
  }),
);
