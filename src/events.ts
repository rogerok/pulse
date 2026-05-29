import { Schema } from "effect";

import { MonitorId } from "./config.ts";

export const ProbeSuccess = Schema.TaggedStruct("ProbeSuccess", {
  at: Schema.Number,
  elapsedMs: Schema.Number,
  monitorId: MonitorId,
  status: Schema.Number,
  // TODO: maybe should be Url schema?
  url: Schema.String,
});

export type ProbeSuccess = Schema.Schema.Type<typeof ProbeSuccess>;

export const ProbeFailure = Schema.TaggedStruct("ProbeFailure", {
  at: Schema.Number,
  monitorId: MonitorId,
  reason: Schema.Literal("timeout", "network", "http-status"),
  url: Schema.String,
});
export type ProbeFailure = Schema.Schema.Type<typeof ProbeFailure>;

export const MonitorPaused = Schema.TaggedStruct("MonitorPaused", {
  at: Schema.Number,
  monitorId: MonitorId,
});

export type MonitorPaused = Schema.Schema.Type<typeof MonitorPaused>;

export const MonitorResumed = Schema.TaggedStruct("MonitorResumed", {
  at: Schema.Number,
  monitorId: MonitorId,
});
export type MonitorResumed = Schema.Schema.Type<typeof MonitorResumed>;

export const MonitorEvent = Schema.Union(ProbeSuccess, ProbeFailure, MonitorPaused, MonitorResumed);
export type MonitorEvent = Schema.Schema.Type<typeof MonitorEvent>;
