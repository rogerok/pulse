import { Clock, Effect } from "effect";

import { generateEventId } from "./events.ts";
import { probe } from "./probe.ts";
import { Bootstrap } from "./services/bootstrap.ts";
import { DomainLimiter } from "./services/domain-limiter.ts";
import { MonitorEvents } from "./services/monitor-events.ts";
import { ProbeQueue } from "./services/probe-queue.ts";

export const worker = Effect.gen(function* () {
  const bootstrap = yield* Bootstrap;
  // Worker можно форкнуть заранее, но реальную работу он начнёт только после bootstrap.
  yield* bootstrap.ready.await;

  const queue = yield* ProbeQueue;
  const limiter = yield* DomainLimiter;
  const bus = yield* MonitorEvents;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    // ProbeQueue даёт work-stealing: каждый monitor заберёт ровно один worker.
    const monitor = yield* queue.take;
    const domain = new URL(monitor.url).hostname;

    // DomainLimiter оборачивает сам probe, поэтому лимит считается вокруг реального HTTP-запроса.
    // probe возвращает status и elapsedMs, из которых worker собирает MonitorEvent.
    const result = yield* limiter.withDomainSlot(domain, probe(monitor.url)).pipe(Effect.either);
    const at = yield* Clock.currentTimeMillis;
    const eventId = yield* generateEventId;

    if (result._tag === "Right") {
      // MonitorEvents — fan-out bus: событие увидят все активные подписчики.
      yield* bus.publish({
        _tag: "ProbeSuccess",
        at,
        elapsedMs: result.right.elapsedMs,
        eventId,
        monitorId: monitor.id,
        status: result.right.status,
        url: monitor.url,
      });
    } else {
      yield* bus.publish({
        _tag: "ProbeFailure",
        at,
        eventId,
        monitorId: monitor.id,
        reason: "network",
        url: monitor.url,
      });
    }
  }
}).pipe(Effect.forever);
