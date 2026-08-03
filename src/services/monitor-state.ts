import { Effect, HashMap, Option, Ref } from "effect";

import { Monitor, MonitorId } from "../config.ts";
import { MonitorEvent } from "../events.ts";
import { ConfigService } from "./config.ts";

export interface MonitorRuntime {
  readonly latest: Option.Option<MonitorEvent>;
  readonly monitor: Monitor;
}

export class MonitorState extends Effect.Service<MonitorState>()("Pulse/MonitorState", {
  effect: Effect.gen(function* () {
    const configService = yield* ConfigService;
    const config = yield* configService.load;

    const initial = HashMap.fromIterable<MonitorId, MonitorRuntime>(
      config.monitors.map((monitor) => [
        monitor.id,
        { latest: Option.none<MonitorEvent>(), monitor },
      ]),
    );

    const state = yield* Ref.make(initial);

    const record = (event: MonitorEvent) =>
      Ref.update(
        state,
        HashMap.modify(event.monitorId, (current) => ({
          ...current,
          latest: Option.some(event),
        })),
      );

    const snapshot = Ref.get(state).pipe(
      Effect.map((current) => Array.from(HashMap.values(current))),
    );

    return {
      record,
      snapshot,
    };
  }),
}) {}
