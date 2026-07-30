import { Effect, Stream } from "effect";

import { MonitorEvents } from "./monitor-events.ts";

export class MonitorEventStream extends Effect.Service<MonitorEventStream>()(
  "Pulse/MonitorEventStream",
  {
    effect: Effect.gen(function* () {
      const bus = yield* MonitorEvents;

      const all = Stream.fromPubSub(bus.pubsub);

      return { all };
    }),
  },
) {}
