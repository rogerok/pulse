import { Effect, Stream } from "effect";

import { MonitorEventStream } from "./monitor-events-stream.ts";

export class EventsFeed extends Effect.Service<EventsFeed>()("Pulse/EventsFeed", {
  effect: Effect.gen(function* () {
    const monitorEvents = yield* MonitorEventStream;

    const feed = yield* Stream.share(monitorEvents.all, {
      capacity: 64,
      idleTimeToLive: "30 seconds",
      replay: 5,
    });

    return { feed };
  }),
}) {}
