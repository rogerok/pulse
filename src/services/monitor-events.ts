import { Effect, PubSub } from "effect";

import { MonitorEvent } from "../events.ts";

export class MonitorEvents extends Effect.Service<MonitorEvents>()("Pulse/MonitorEvents", {
  scoped: Effect.gen(function* () {
    // PubSub — fan-out bus: каждый subscriber получает каждое опубликованное событие.
    // bounded(256) задаёт буфер на подписчика и даёт backpressure, если subscriber отстаёт.
    const pubsub = yield* PubSub.bounded<MonitorEvent>(256);

    return {
      // Worker публикует сюда результат probe.
      publish: (e: MonitorEvent) => PubSub.publish(pubsub, e),
      pubsub,
      // Program, storage, console-printer или будущий notifier могут подписаться отдельно.
      subscribe: PubSub.subscribe(pubsub),
    };
  }),
}) {}
