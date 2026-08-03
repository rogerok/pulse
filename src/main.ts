import { Effect, Layer, Stream } from "effect";

import { Bootstrap } from "./services/bootstrap.ts";
import { ConfigPathLive, ConfigService, ConfigServiceLive } from "./services/config.ts";
import { DnsCache } from "./services/dns.ts";
import { DomainLimiter } from "./services/domain-limiter.ts";
import { FsLive } from "./services/fs.ts";
import { HttpLive } from "./services/http.ts";
import { JsonlWriter } from "./services/jsonl-writer.ts";
import { MonitorEvents } from "./services/monitor-events.ts";
import { MonitorState } from "./services/monitor-state.ts";
import { ProbeQueue } from "./services/probe-queue.ts";
import { Sla } from "./services/sla.ts";
import { StorageLive } from "./services/storage.ts";
import { Whois } from "./services/whois.ts";

export const ConfigLive = ConfigServiceLive.pipe(
  Layer.provide(Layer.mergeAll(FsLive, ConfigPathLive)),
);
const Storage = StorageLive.pipe(Layer.provide(Layer.mergeAll(FsLive, ConfigLive)));

const BootstrapLive = Bootstrap.Default.pipe(Layer.provide(ConfigLive));
const ProbeQueueLive = ProbeQueue.Default;
const MonitorEventsLive = MonitorEvents.Default;
const DomainLimiterLive = DomainLimiter.Default;
const JsonlWriterLive = JsonlWriter.Default.pipe(
  Layer.provide(Layer.mergeAll(Storage, MonitorEventsLive)),
);
const MonitorStateLive = MonitorState.Default.pipe(Layer.provide(ConfigLive));
const MonitorStateRunning = Layer.scopedDiscard(
  Effect.gen(function* () {
    const state = yield* MonitorState;
    const events = yield* MonitorEvents;

    const stream = yield* Stream.fromPubSub(events.pubsub, {
      scoped: true,
    });

    yield* Effect.forkScoped(stream.pipe(Stream.runForEach(state.record)));
  }),
).pipe(Layer.provide(Layer.mergeAll(MonitorStateLive, MonitorEventsLive)));

const JsonlWriterEnabled = Layer.scopedDiscard(
  Effect.gen(function* () {
    const writer = yield* JsonlWriter;

    yield* Effect.forkScoped(writer.run);
  }),
).pipe(Layer.provide(JsonlWriterLive));

const JsonlWriterRunning = Layer.unwrapEffect(
  Effect.gen(function* () {
    const configService = yield* ConfigService;
    const config = yield* configService.load;

    return config.defaults.writeJsonl ? JsonlWriterEnabled : Layer.empty;
  }),
).pipe(Layer.provide(ConfigLive));

export const MainLive = Layer.mergeAll(
  BootstrapLive,
  ConfigLive,
  DnsCache.Default,
  DomainLimiterLive,
  HttpLive,
  JsonlWriterRunning,
  MonitorEventsLive,
  MonitorStateLive,
  MonitorStateRunning,
  ProbeQueueLive,
  Sla.Default,
  Whois.Default,
);
