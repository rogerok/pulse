import { Effect, Exit, Layer, ManagedRuntime, Schema } from "effect";
import { expect } from "vitest";

import { EventId, MonitorId, PulseConfig } from "../src/config.ts";
import { NetworkError } from "../src/errors.ts";
import { MonitorEvent } from "../src/events.ts";
import { probe } from "../src/probe/probe.ts";
import { ConfigService } from "../src/services/config.ts";
import { DnsCache } from "../src/services/dns.ts";
import { FsService } from "../src/services/fs.ts";
import { HttpService } from "../src/services/http.ts";
import { MonitorEvents } from "../src/services/monitor-events.ts";
import { Storage, StorageLive } from "../src/services/storage.ts";
import { Whois } from "../src/services/whois.ts";
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

const storageConfig = Schema.decodeUnknownSync(PulseConfig)({
  defaults: { jsonlPath: "test-events.jsonl" },
  monitors: [],
});
const ConfigMock = Layer.mock(ConfigService, {
  _tag: "Pulse/ConfigService",
  load: Effect.succeed(storageConfig),
});

const ProbeDependencies = Layer.mergeAll(DnsMock, MonitorEvents.Default, WhoisMock);

const makeTarget = (url: string) => ({
  host: new URL(url).hostname,
  id: MonitorId.make("probe-test"),
  url,
});

describe("probe", () => {
  it("probe", async () => {
    let abSignal: AbortSignal | undefined;

    const HttpMock = Layer.mock(HttpService, {
      _tag: "Pulse/HttpService",
      get: (_url, signal) =>
        Effect.sync(() => {
          abSignal = signal;
        }).pipe(Effect.zipRight(Effect.fail(new NetworkError({ cause: "", url: "" })))),
    });

    const exit = await Effect.runPromise(
      probe(makeTarget("https://example.com")).pipe(
        Effect.provide(Layer.mergeAll(HttpMock, ProbeDependencies)),
        Effect.exit,
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(abSignal?.aborted).toBe(true);
  });

  it("probe with parent", async () => {
    let abSignal: AbortSignal | undefined;
    let parentClosed = false;

    const event: MonitorEvent = {
      _tag: "MonitorPaused",
      at: 1_700_000_000_000,
      eventId: EventId.make("1700000000000-5500"),
      monitorId: MonitorId.make("github-www"),
    };
    const HttpMock = Layer.mock(HttpService, {
      _tag: "Pulse/HttpService",
      get: (_url, signal) =>
        Effect.sync(() => {
          abSignal = signal;
        }).pipe(Effect.zipRight(Effect.fail(new NetworkError({ cause: "", url: "" })))),
    });

    const FsMock = Layer.mock(FsService, {
      _tag: "Pulse/FsService",
      append: () =>
        Effect.succeed({
          close: () => Effect.sync(() => (parentClosed = true)),
          write: () => Effect.void,
        }),
    });

    const TestLive = StorageLive.pipe(Layer.provide(Layer.mergeAll(FsMock, ConfigMock)));

    const runtime = ManagedRuntime.make(Layer.mergeAll(TestLive, HttpMock, ProbeDependencies));

    const exit = await runtime.runPromise(
      Effect.gen(function* () {
        const storage = yield* Storage;
        yield* storage.append(event);

        return yield* probe(makeTarget("http://example.com")).pipe(Effect.exit);
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(abSignal?.aborted).toBe(true);

    await runtime.dispose();

    expect(parentClosed).toBe(true);
  });

  it("probe concurrency", async () => {
    const HttpMock = Layer.mock(HttpService, {
      _tag: "Pulse/HttpService",
      get: (_url) =>
        Effect.gen(function* () {
          yield* Effect.sleep(1);

          return {
            body: "s",
            status: 200,
          };
        }),
    });

    const urls = [
      "https://example.com0",
      "https://example.com1",
      "https://example.com2",
      "https://example.com3",
      "https://example.com4",
    ] as const;

    const concurrency = 2;

    let activeProbes = 0;
    let maxActive = 0;

    const program = Effect.forEach(
      urls,
      (url) =>
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            activeProbes += 1;
            maxActive = Math.max(maxActive, activeProbes);
          });

          yield* probe(makeTarget(url)).pipe(
            Effect.provide(Layer.mergeAll(HttpMock, ProbeDependencies)),
          );
        }).pipe(
          Effect.ensuring(
            Effect.gen(function* () {
              yield* Effect.sync(() => {
                activeProbes -= 1;
              });
            }),
          ),
        ),
      { concurrency },
    );

    await Effect.runPromise(program);

    expect(maxActive).equal(concurrency);
  });
});
