import { Command, Options } from "@effect/cli";
import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { createServer } from "node:http";

import { PulseApiLive } from "../../api.ts";
import { probeLoop } from "../../probe/loop.ts";
import { ConfigService } from "../../services/config.ts";

const serverLayer = (port: number) =>
  HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
    Layer.provide(PulseApiLive),
    HttpServer.withLogAddress,
    Layer.provide(NodeHttpServer.layer(() => createServer(), { port })),
  );

const port = Options.integer("port").pipe(Options.withDefault(8080));

const runProbeLoops = Effect.gen(function* () {
  const configService = yield* ConfigService;
  const config = yield* configService.load;

  yield* Effect.forEach(config.monitors, probeLoop, {
    concurrency: "unbounded",
    discard: true,
  });
});

export const serveCommand = Command.make("serve", { port }, ({ port }) =>
  Effect.gen(function* () {
    yield* Effect.log(`pulse слушает на :${port}`);

    yield* Effect.all([runProbeLoops, Layer.launch(serverLayer(port))], {
      concurrency: "unbounded",
      discard: true,
    });
  }),
);
