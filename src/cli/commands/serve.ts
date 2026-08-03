import { Command } from "@effect/cli";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import http from "node:http";

import { program } from "../../program.ts";
import { makeServeLive } from "../../serve.ts";

export const serveCommand = Command.make("serve", {}, () =>
  Effect.gen(function* () {
    const NodeServerLive = NodeHttpServer.layer(() => http.createServer(), {
      port: 3000,
    });
    const AppLive = makeServeLive(program).pipe(Layer.provide(NodeServerLive));

    yield* Layer.launch(AppLive);
  }),
);
