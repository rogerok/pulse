import { Args, Command, Options } from "@effect/cli";
import { Effect } from "effect";

import { Interval, IntervalMs, Monitor, MonitorId, Url } from "../../config.ts";
import { ConfigService } from "../../services/config.ts";

const url = Args.text({ name: "url" }).pipe(Args.withSchema(Url));
const fallbackUrl = Args.text({ name: "fallbackUrl" }).pipe(Args.withSchema(Url));
const id = Args.text({ name: "id" }).pipe(Args.withSchema(MonitorId));
const interval = Options.text("interval").pipe(
  Options.withSchema(Interval),
  Options.withDefault(IntervalMs.make(30_000)),
);
const expectStatus = Options.integer("expect-status").pipe(Options.withDefault(200));

export const addCommand = Command.make(
  "add",
  { expectStatus, fallbackUrl, id, interval, url },
  ({ expectStatus, fallbackUrl, id, interval, url }) =>
    Effect.gen(function* () {
      yield* Effect.log(`добавляю ${url} с интервалом ${interval}, ждём ${expectStatus}`);

      const monitor = Monitor.make({
        expect: {
          status: expectStatus,
        },
        fallbackUrl,
        id,
        interval,
        url,
      });

      const configService = yield* ConfigService;

      yield* configService.addMonitor(monitor);
    }),
);

export const removeCommand = Command.make("remove", { url }, ({ url }) =>
  Effect.gen(function* () {
    yield* Effect.log(`удаляю ${url}`);

    const configService = yield* ConfigService;

    yield* configService.removeMonitor(url);
  }),
);

export const list = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const configService = yield* ConfigService;
    const config = yield* configService.getConfig;

    yield* Effect.forEach(config.monitors, (m) => Effect.log(m));
  }),
);

export const monitorCommand = Command.make("monitor").pipe(
  Command.withDescription("Управление списком отслеживаемых URL"),
  Command.withSubcommands([addCommand, removeCommand, list]),
);
