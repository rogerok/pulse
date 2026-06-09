import { Context, Effect } from "effect";

import type { Monitor } from "../config.ts";

export type CurrentMonitorValue = Pick<Monitor, "id" | "url">;

export class CurrentMonitor extends Context.Tag("Pulse/CurrentMonitor")<
  CurrentMonitor,
  CurrentMonitorValue
>() {
  static readonly provide = (monitor: CurrentMonitorValue) => Effect.provideService(this, monitor);
}
