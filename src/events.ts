import { Clock, Effect, Random, Schema } from "effect";

import { EventId, MonitorId } from "./config.ts";

export const ProbeSuccess = Schema.TaggedStruct("ProbeSuccess", {
  at: Schema.Number,
  elapsedMs: Schema.Number,
  eventId: EventId,
  monitorId: MonitorId,
  status: Schema.Number,
  // TODO: maybe should be Url schema?
  url: Schema.String,
});

export type ProbeSuccess = Schema.Schema.Type<typeof ProbeSuccess>;

export const ProbeFailure = Schema.TaggedStruct("ProbeFailure", {
  at: Schema.Number,
  eventId: EventId,
  monitorId: MonitorId,
  reason: Schema.Literal("timeout", "network", "http-status"),
  url: Schema.String,
});
export type ProbeFailure = Schema.Schema.Type<typeof ProbeFailure>;

export const MonitorPaused = Schema.TaggedStruct("MonitorPaused", {
  at: Schema.Number,
  eventId: EventId,
  monitorId: MonitorId,
});

export type MonitorPaused = Schema.Schema.Type<typeof MonitorPaused>;

export const MonitorResumed = Schema.TaggedStruct("MonitorResumed", {
  at: Schema.Number,
  eventId: EventId,
  monitorId: MonitorId,
});
export type MonitorResumed = Schema.Schema.Type<typeof MonitorResumed>;

export const MonitorEvent = Schema.Union(ProbeSuccess, ProbeFailure, MonitorPaused, MonitorResumed);
export type MonitorEvent = Schema.Schema.Type<typeof MonitorEvent>;
export const generateEventId = Effect.gen(function* () {
  const ms = yield* Clock.currentTimeMillis;
  const suffix = yield* Random.nextIntBetween(1000, 9999);

  return EventId.make(`${ms}-${suffix}`);
});
