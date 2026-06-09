import { Effect } from "effect";
import * as http from "node:http";

import { decodeFromFile } from "./config.ts";
import { formatAlert, recordResult } from "./matching.ts";
import { probe } from "./probe.ts";
import { runtime } from "./runtime.ts";
import { CurrentMonitor } from "./services/monitor.ts";

const isWatch = (): boolean => process.argv[2] === "watch";
const isServe = (): boolean => process.argv[2] === "serve";

const program = Effect.gen(function* () {
  const config = yield* decodeFromFile("./src/pulse.config.json");

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
});

if (isWatch()) {
  try {
    await runtime.runPromise(
      program.pipe(
        Effect.catchAll((e) =>
          Effect.gen(function* () {
            yield* Effect.logError(formatAlert(e));
            process.exitCode = 2;
          }),
        ),
      ),
    );
  } finally {
    await runtime.dispose();
  }
} else if (isServe()) {
  /*
   * Если для второго входа собрать отдельно MainLive через Effect.proive(MainLive),
   * то построение графа будет происходить на каждом запросе, мемоизация сломается.
   * ManagedRuntime.make создает внутренний MemoMap, и между двумя рантаймами MemoMap не делится
   */

  const close = async (): Promise<void> => {
    server.close();
    await runtime.dispose();
    process.exit(0);
  };

  const run = async (): Promise<void> => {
    await runtime.runPromise(program);
  };

  const server = http.createServer((_req, res) => {
    void run()
      .then(() => {
        res.statusCode = 200;
        res.end("ok");
      })
      .catch(() => {
        res.statusCode = 500;
        res.end("err");
      });
  });

  server.listen(3000);
  console.log("server listening on http://localhost:3000");

  process.on("SIGINT", () => {
    void close();
  });
} else {
  console.error("Usage: pnpm start watch | serve");
  process.exitCode = 1;
}
