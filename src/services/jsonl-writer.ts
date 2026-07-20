import { FileSystem } from "@effect/platform";
import { Chunk, Effect, Stream } from "effect";

import { MonitorEvent } from "../events.ts";
import { MonitorEventStream } from "./monitor-events-stream.ts";

export class JsonlWriter extends Effect.Service<JsonlWriter>()("Pulse/JsonlWriter", {
  effect: Effect.gen(function* () {
    const events = yield* MonitorEventStream;
    const fs = yield* FileSystem.FileSystem;

    const writeBatch = (batch: Chunk.Chunk<MonitorEvent>) =>
      fs.writeFile(
        "events.jsonl",
        new TextEncoder().encode(
          Chunk.toReadonlyArray(batch)
            .map((e) => JSON.stringify(e))
            .join("\n") + "\n",
        ),
        { flag: "a" },
      );

    const run = events.all.pipe(
      Stream.groupedWithin(64, "1 second"),
      Stream.tap(writeBatch),
      Stream.runDrain,
    );

    return { run };
  }),
}) {}
