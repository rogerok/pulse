import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";

import { ConfigLive, MainLive } from "../main.ts";
import { initCommand } from "./commands/init.ts";
import { monitorCommand } from "./commands/monitor.ts";
import { serveCommand } from "./commands/serve.ts";
import { watchCommand } from "./commands/watch.ts";

const root = Command.make("pulse").pipe(
  Command.withDescription("Корневая команда"),
  Command.withSubcommands([
    monitorCommand.pipe(Command.provide(MainLive)),
    serveCommand.pipe(Command.provide(MainLive)),
    watchCommand.pipe(Command.provide(MainLive)),
    initCommand.pipe(Command.provide(ConfigLive)),
  ]),
);

const cli = Command.run(root, { name: "pulse", version: "0.1.0" });

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
