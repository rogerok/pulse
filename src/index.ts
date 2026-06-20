import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import http from "node:http";

import { MainLive } from "./main.ts";
import { program } from "./program.ts";
import { isServe, makeServeLive } from "./serve.ts";
import { isWatch, makeWatch } from "./watch.ts";

if (isWatch()) {
  NodeRuntime.runMain(makeWatch(program).pipe(Effect.provide(MainLive)));
} else if (isServe()) {
  const NodeServerLive = NodeHttpServer.layer(() => http.createServer(), {
    port: 3000,
  });

  const AppLive = makeServeLive(program).pipe(
    Layer.provide(Layer.mergeAll(NodeServerLive, MainLive)),
  );

  NodeRuntime.runMain(Layer.launch(AppLive));
} else {
  console.error("Usage: pnpm start watch | serve");
  process.exitCode = 1;
}
