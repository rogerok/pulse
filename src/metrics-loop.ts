import { Chunk, Console, Effect, Stream } from "effect";

import { MonitorEventStream } from "./services/monitor-events-stream.ts";

export const metricsLoop = Effect.gen(function* () {
  const events = yield* MonitorEventStream;

  yield* events.all.pipe(
    // Number.MAX_SAFE_INTEGER: мы не хотим срабатывание по числу, только по времени. groupedWithin отдаст всё, что накопилось за 5 секунд
    Stream.groupedWithin(Number.MAX_SAFE_INTEGER, "5 seconds"),
    Stream.tap((batch) => {
      const arr = Chunk.toReadonlyArray(batch);
      const successes = arr.filter((e) => e._tag === "ProbeSuccess").length;
      const failures = arr.filter((e) => e._tag === "ProbeFailure").length;
      return Console.log(`[5s] ok=${successes} fail=${failures}`);
    }),
    Stream.runDrain,
  );
});
