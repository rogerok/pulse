import { Effect, Stream } from "effect";

import { type MonitorEvent } from "../events.ts";
import { MonitorEvents } from "./monitor-events.ts";

export class MonitorEventStream extends Effect.Service<MonitorEventStream>()(
  "Pulse/MonitorEventStream",
  {
    effect: Effect.gen(function* () {
      const bus = yield* MonitorEvents;

      const all: Stream.Stream<MonitorEvent> = yield* Stream.fromPubSub(bus.pubsub, {
        scoped: true,
      });

      return { all };
    }),
  },
) {}
