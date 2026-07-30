import { Chunk, Effect, Stream } from "effect";

import { MonitorEvent } from "../events.ts";
import { MonitorEvents } from "./monitor-events.ts";
import { Storage } from "./storage.ts";

export class JsonlWriter extends Effect.Service<JsonlWriter>()("Pulse/JsonlWriter", {
  scoped: Effect.gen(function* () {
    const bus = yield* MonitorEvents;
    const storage = yield* Storage;

    const writeBatch = (batch: Chunk.Chunk<MonitorEvent>) =>
      storage.appendBatch(Chunk.toReadonlyArray(batch));

    const events = yield* Stream.fromPubSub(bus.pubsub, {
      scoped: true,
    });

    const run = events.pipe(
      Stream.groupedWithin(64, "1 second"),
      Stream.tap(writeBatch),
      Stream.runDrain,
    );

    return { run };
  }),
}) {}
