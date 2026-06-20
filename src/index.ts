import { HttpLayerRouter, HttpServerResponse } from "@effect/platform";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import * as http from "node:http";

import { MainLive } from "./main.ts";
import { program } from "./program.ts";
import { watch } from "./watch.ts";

const isWatch = (): boolean => process.argv[2] === "watch";
const isServe = (): boolean => process.argv[2] === "serve";

if (isWatch()) {
  NodeRuntime.runMain(watch);
} else if (isServe()) {
  const handler = program.pipe(
    Effect.as(HttpServerResponse.text("ok")),
    Effect.catchAll(() => Effect.succeed(HttpServerResponse.text("err", { status: 500 }))),
  );

  const RouteLive = HttpLayerRouter.add("GET", "/", handler);
  const ServeLive = HttpLayerRouter.serve(RouteLive);

  const NodeServerLive = NodeHttpServer.layer(() => http.createServer(), { port: 3000 });
  const AppLive = ServeLive.pipe(Layer.provide(Layer.mergeAll(NodeServerLive, MainLive)));

  NodeRuntime.runMain(Layer.launch(AppLive));
} else {
  console.error("Usage: pnpm start watch | serve");
  process.exitCode = 1;
}
