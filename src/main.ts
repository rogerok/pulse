import { Effect, Layer } from "effect";

import { Bootstrap } from "./services/bootstrap.ts";
import { ConfigPathLive, ConfigServiceLive } from "./services/config.ts";
import { DnsCache } from "./services/dns.ts";
import { DomainLimiter } from "./services/domain-limiter.ts";
import { FsLive } from "./services/fs.ts";
import { HttpLive } from "./services/http.ts";
import { JsonlWriter } from "./services/jsonl-writer.ts";
import { MonitorEvents } from "./services/monitor-events.ts";
import { ProbeQueue } from "./services/probe-queue.ts";
import { Sla } from "./services/sla.ts";
import { StorageConfigLive, StorageLive } from "./services/storage.ts";
import { Whois } from "./services/whois.ts";

const Config = ConfigServiceLive.pipe(Layer.provide(Layer.mergeAll(FsLive, ConfigPathLive)));
const Storage = StorageLive.pipe(Layer.provide(Layer.mergeAll(FsLive, StorageConfigLive)));

const BootstrapLive = Bootstrap.Default.pipe(Layer.provide(Config));
const ProbeQueueLive = ProbeQueue.Default;
const MonitorEventsLive = MonitorEvents.Default;
const DomainLimiterLive = DomainLimiter.Default;
const JsonlWriterLive = JsonlWriter.Default.pipe(
  Layer.provide(Layer.mergeAll(Storage, MonitorEventsLive)),
);

const JsonlWriterRunning = Layer.scopedDiscard(
  Effect.gen(function* () {
    const writer = yield* JsonlWriter;
    yield* Effect.forkScoped(writer.run);
  }),
).pipe(Layer.provide(JsonlWriterLive));

export const MainLive = Layer.mergeAll(
  Storage,
  HttpLive,
  Config,
  BootstrapLive,
  ProbeQueueLive,
  MonitorEventsLive,
  DomainLimiterLive,
  Sla.Default,
  DnsCache.Default,
  Whois.Default,
  JsonlWriterRunning,
);
