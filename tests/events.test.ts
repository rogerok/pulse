import { Effect, Random, Schema } from "effect";

import { EventId, MonitorId } from "../src/config.ts";
import { generateEventId, MonitorEvent } from "../src/events.ts";

describe("generateEventId", () => {
  it("uses fixed Random to generate deterministic suffix", async () => {
    const eventId = await Effect.runPromise(
      generateEventId.pipe(Effect.withRandom(Random.fixed([0.5]))),
    );

    expect(eventId).toMatch(/^\d+-\d{4}$/);
    expect(eventId.endsWith("-1000")).toBe(true);
  });
});

const eventId = EventId.make("1700000000000-5500");

describe("MonitorEvent", () => {
  it.each([
    {
      _tag: "ProbeSuccess" as const,
      at: 1_700_000_000_000,
      elapsedMs: 142,
      eventId,
      monitorId: MonitorId.make("github-www"),
      status: 200,
      url: "https://github.com",
    },
    {
      _tag: "ProbeFailure" as const,
      at: 1_700_000_000_001,
      eventId,
      monitorId: MonitorId.make("self-api"),
      reason: "network" as const,
      url: "https://api.self.local/health",
    },
    {
      _tag: "MonitorPaused" as const,
      at: 1_700_000_000_002,
      eventId,
      monitorId: MonitorId.make("github-www"),
    },
    {
      _tag: "MonitorResumed" as const,
      at: 1_700_000_000_003,
      eventId,
      monitorId: MonitorId.make("github-www"),
    },
  ])("round-trips %#", (event) => {
    const wire = Schema.encodeSync(MonitorEvent)(event);
    expect(Schema.decodeUnknownSync(MonitorEvent)(wire)).toEqual(event);
  });
});
