import { Effect, Queue } from "effect";

import { ConfigService } from "./services/config.ts";
import { MonitorEvents } from "./services/monitor-events.ts";
import { ProbeQueue } from "./services/probe-queue.ts";
import { Storage } from "./services/storage.ts";
import { worker } from "./worker.ts";

export const program = Effect.scoped(
  Effect.gen(function* () {
    const configService = yield* ConfigService;
    const config = yield* configService.getConfig;

    const queue = yield* ProbeQueue;
    const bus = yield* MonitorEvents;
    const storage = yield* Storage;
    const subscription = yield* bus.subscribe;

    // Program связывает три примитива:
    // ProbeQueue принимает задания, worker-ы их выполняют, MonitorEvents отдаёт результаты.
    // Запускаем worker-ы на время этого scoped-блока.
    // Когда program завершится или будет interrupted, forkScoped прервёт worker-ы.
    yield* Effect.forEach(Array.from({ length: 2 }), () => Effect.forkScoped(worker), {
      concurrency: "unbounded",
    });

    // Producer: кладём все monitors из конфига в очередь.
    yield* Effect.forEach(config.monitors, (monitor) => queue.enqueue(monitor));

    // Consumer: ждём ровно по одному событию на каждый monitor.
    const events = yield* Effect.forEach(config.monitors, () => Queue.take(subscription));

    yield* Effect.forEach(
      events,
      (event) =>
        Effect.gen(function* () {
          // Storage подписан через program: worker только публикует события в bus.
          yield* storage.append(event);

          yield* Effect.gen(function* () {
            if (event._tag === "ProbeSuccess") {
              yield* Effect.log(
                `${event.monitorId}: status ${event.status} in ${event.elapsedMs} ms`,
              );
            } else if (event._tag === "ProbeFailure") {
              yield* Effect.logError(`${event.monitorId}: ${event.reason}`);
            }
          });
        }),
      { concurrency: 2 },
    );
  }),
);
