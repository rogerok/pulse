import { Effect } from "effect";

import { decodeFromFile } from "./config.ts";
import { recordResult } from "./matching.ts";
import { probe } from "./probe.ts";
import { CurrentMonitor } from "./services/monitor.ts";
import { Storage } from "./services/storage.ts";

export const program = Effect.gen(function* () {
  const config = yield* decodeFromFile("./src/pulse.config.json");
  const monitors = config.monitors;

  const startedAtConcurrent = yield* Effect.sync(() => Date.now());

  /**
   * Запуск итерации по мониторам два раза подряд - пример для демонстрации
   * Благодаря замерам от начала и до конца итераций, можно увидеть разницу
   * в скорости выполнения пробинга с конкуренцией и без.
   * С помощью счётчик activeProbes убеждаемся что активных пробингов не больше 2
   */
  let activeProbes = 0;

  yield* Effect.forEach(
    monitors,
    (m) =>
      Effect.gen(function* () {
        yield* Effect.sync(() => {
          activeProbes += 1;
        });

        yield* Effect.log(`${m.url} in work.\n probes in work: ${activeProbes}`);

        const event = yield* recordResult(probe(m.url)).pipe(
          Effect.ensuring(
            Effect.gen(function* () {
              yield* Effect.sync(() => {
                activeProbes -= 1;
              });
              yield* Effect.log(`${m.url} finished work.\n active probes: ${activeProbes}`);
            }),
          ),
        );

        const storage = yield* Storage;

        yield* storage.append(event);

        yield* Effect.sync(() => {
          if (event._tag === "ProbeSuccess") {
            console.log(`${event.monitorId}: status ${event.status} in ${event.elapsedMs} ms`);
          } else if (event._tag === "ProbeFailure") {
            console.warn(`${event.monitorId}: ${event.reason}`);
          }
        });
      }).pipe(CurrentMonitor.provide(m)),
    { concurrency: 2 },
  );

  const elapsedMsConcurrent = yield* Effect.sync(() => Date.now() - startedAtConcurrent);
  yield* Effect.log(`elapsedMsConcurrent finished in ${elapsedMsConcurrent} ms`);

  const startedAt = yield* Effect.sync(() => Date.now());

  for (const monitor of config.monitors) {
    yield* Effect.gen(function* () {
      const event = yield* recordResult(probe(monitor.url));

      yield* Effect.sync(() => {
        if (event._tag === "ProbeSuccess") {
          console.log(`${event.monitorId}: status ${event.status} in ${event.elapsedMs} ms`);
        } else if (event._tag === "ProbeFailure") {
          console.warn(`${event.monitorId}: ${event.reason}`);
        }
      });
    }).pipe(CurrentMonitor.provide(monitor));
  }

  const elapsedMs = yield* Effect.sync(() => Date.now() - startedAt);

  yield* Effect.log(`elapsedMs finished in ${elapsedMs} ms`);

  const differenceBetweenModes = elapsedMs - elapsedMsConcurrent;
  const result =
    differenceBetweenModes === 0 ? "equal" : differenceBetweenModes > 0 ? "faster" : "slower";

  if (result === "equal") {
    yield* Effect.log(`concurrent mode is equal to default`);
  } else {
    yield* Effect.log(
      `concurrent mode is ${result} than default in ${Math.abs(differenceBetweenModes)}`,
    );
  }
});
