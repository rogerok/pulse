import { Layer } from "effect";

import { Bootstrap } from "./services/bootstrap.ts";
import { ConfigPathLive, ConfigServiceLive } from "./services/config.ts";
import { DomainLimiter } from "./services/domain-limiter.ts";
import { FsLive } from "./services/fs.ts";
import { HttpLive } from "./services/http.ts";
import { MonitorEvents } from "./services/monitor-events.ts";
import { ProbeQueue } from "./services/probe-queue.ts";
import { StorageConfigLive, StorageLive } from "./services/storage.ts";

const Config = ConfigServiceLive.pipe(Layer.provide(Layer.mergeAll(FsLive, ConfigPathLive)));
const Storage = StorageLive.pipe(Layer.provide(Layer.mergeAll(FsLive, StorageConfigLive)));

const BootstrapLive = Bootstrap.Default.pipe(Layer.provide(Config));
const ProbeQueueLive = ProbeQueue.Default;
const MonitorEventsLive = MonitorEvents.Default;
const DomainLimiterLive = DomainLimiter.Default;

export const MainLive = Layer.mergeAll(
  Storage,
  HttpLive,
  Config,
  BootstrapLive,
  ProbeQueueLive,
  MonitorEventsLive,
  DomainLimiterLive,
);
