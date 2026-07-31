import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";

import { MainLive } from "../main.ts";
import { monitorCommand } from "./commands/monitor.ts";
import { serveCommand } from "./commands/serve.ts";
import { watchCommand } from "./commands/watch.ts";

const root = Command.make("pulse").pipe(
  Command.withDescription("Корневая команда"),
  Command.withSubcommands([monitorCommand, serveCommand, watchCommand]),
);

const cli = Command.run(root, { name: "pulse", version: "0.1.0" });

cli(process.argv).pipe(
  Effect.provide(MainLive),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
);
