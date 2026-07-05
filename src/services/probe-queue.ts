import { Effect, Queue } from "effect";

import { type Monitor } from "../config.ts";

export class ProbeQueue extends Effect.Service<ProbeQueue>()("Pulse/ProbeQueue", {
  scoped: Effect.gen(function* () {
    // Queue — work queue: один monitor будет обработан ровно одним worker-ом.
    // bounded(1024) защищает процесс от бесконечного накопления заданий.
    const queue = yield* Queue.bounded<Monitor>(1024);

    return {
      // Producer кладёт сюда monitors из конфига.
      enqueue: (monitor: Monitor) => Queue.offer(queue, monitor),
      // Worker-ы конкурируют на take; каждое задание получает только один worker.
      take: Queue.take(queue),
    };
  }),
}) {}
