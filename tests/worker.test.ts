import { Effect, Fiber, Layer, Option, Queue, Schema } from "effect";
import { describe } from "vitest";

import type { MonitorEvent } from "../src/events.ts";

import { type Monitor, PulseConfig } from "../src/config.ts";
import { Bootstrap } from "../src/services/bootstrap.ts";
import { DomainLimiter } from "../src/services/domain-limiter.ts";
import { DnsCache } from "../src/services/dns.ts";
import { HttpService } from "../src/services/http.ts";
import { MonitorEvents } from "../src/services/monitor-events.ts";
import { ProbeQueue } from "../src/services/probe-queue.ts";
import { Whois } from "../src/services/whois.ts";
import { worker } from "../src/worker.ts";

const mockResp = { body: "OK", status: 200 };
const HttpMock = Layer.mock(HttpService, {
  _tag: "Pulse/HttpService",
  get: (_url) => Effect.succeed(mockResp),
});

const DnsMock = Layer.mock(DnsCache, {
  _tag: "Pulse/DnsCache",
  lookup: () => Effect.succeed("127.0.0.1"),
});

const WhoisMock = Layer.mock(Whois, {
  _tag: "Pulse/Whois",
  lookup: () =>
    Effect.succeed({
      expiresAt: new Date("2100-01-01T00:00:00.000Z"),
      registrar: "Test Registrar",
    }),
});

const expectProbeSuccess = (event: MonitorEvent, monitor: Monitor) => {
  expect(event._tag).toBe("ProbeSuccess");

  if (event._tag === "ProbeSuccess") {
    expect(event.monitorId).toBe(monitor.id);
    expect(event.url).toBe(monitor.url);
    expect(event.status).toBe(200);
    expect(typeof event.elapsedMs).toBe("number");
    expect(typeof event.at).toBe("number");
  }
};

const takeEvent = (subscription: Queue.Dequeue<MonitorEvent>) =>
  Queue.take(subscription).pipe(
    Effect.timeoutFail({
      duration: "1 second",
      onTimeout: () => new Error("Time out waiting for worker event"),
    }),
  );

const createBootstrapMock = (latch: Effect.Latch) =>
  Layer.mock(Bootstrap, {
    _tag: "Pulse/Bootstrap",
    ready: latch,
  });

const createTestLive = (latch: Effect.Latch) =>
  Layer.mergeAll(
    createBootstrapMock(latch),
    ProbeQueue.Default,
    MonitorEvents.Default,
    DomainLimiter.Default,
    HttpMock,
    DnsMock,
    WhoisMock,
  );

describe("worker", () => {
  const config = Schema.decodeUnknownSync(PulseConfig)({
    monitors: [
      {
        id: "github-www",
        interval: "30s",
        url: "https://github.com",
      },
    ],
  });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const monitor = config.monitors[0]!;

  it("publishes ProbeSuccess for a queued monitor after bootstrap is ready", async () => {
    const program = Effect.gen(function* () {
      const latch = yield* Effect.makeLatch(true);

      const TestLive = createTestLive(latch);

      yield* Effect.gen(function* () {
        const bus = yield* MonitorEvents;
        const subscription = yield* bus.subscribe;

        const queue = yield* ProbeQueue;

        const fiber = yield* Effect.fork(worker);

        yield* queue.enqueue(monitor);

        const event = yield* takeEvent(subscription);
        expectProbeSuccess(event, monitor);

        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(TestLive));
    });

    await Effect.runPromise(program.pipe(Effect.scoped));
  });

  it("does not publish before bootstrap is ready", async () => {
    const program = Effect.gen(function* () {
      const latch = yield* Effect.makeLatch(false);

      const TestLive = createTestLive(latch);

      yield* Effect.gen(function* () {
        const bus = yield* MonitorEvents;
        const subscription = yield* bus.subscribe;

        const queue = yield* ProbeQueue;

        const fiber = yield* Effect.fork(worker);

        yield* queue.enqueue(monitor);
        const beforeOpen = yield* Queue.take(subscription).pipe(Effect.timeoutOption("50 millis"));
        expect(Option.isNone(beforeOpen)).toBe(true);

        yield* latch.open;

        const event = yield* takeEvent(subscription);

        expectProbeSuccess(event, monitor);

        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(TestLive));
    });

    await Effect.runPromise(program.pipe(Effect.scoped));
  });
});
