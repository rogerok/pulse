import { Schema } from "effect";

import { MonitorId } from "../src/config.ts";
import { MonitorEvent } from "../src/events.ts";

describe("MonitorEvent", () => {
  it.each([
    {
      _tag: "ProbeSuccess" as const,
      at: 1_700_000_000_000,
      elapsedMs: 142,
      monitorId: MonitorId.make("github-www"),
      status: 200,
      url: "https://github.com",
    },
    {
      _tag: "ProbeFailure" as const,
      at: 1_700_000_000_001,
      monitorId: MonitorId.make("self-api"),
      reason: "network" as const,
      url: "https://api.self.local/health",
    },
    {
      _tag: "MonitorPaused" as const,
      at: 1_700_000_000_002,
      monitorId: MonitorId.make("github-www"),
    },
    {
      _tag: "MonitorResumed" as const,
      at: 1_700_000_000_003,
      monitorId: MonitorId.make("github-www"),
    },
  ])("round-trips %#", (event) => {
    const wire = Schema.encodeSync(MonitorEvent)(event);
    expect(Schema.decodeUnknownSync(MonitorEvent)(wire)).toEqual(event);
  });
});
