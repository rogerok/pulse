import { Cause, Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { MonitorId } from "../src/config.ts";
import {
  BodyContractError,
  ConfigParseError,
  HttpStatusError,
  NetworkError,
  StorageError,
  TimeoutError,
} from "../src/errors.ts";
import { divideOrDie, formatAlert, recordResult } from "../src/matching.ts";

const id = Schema.decodeUnknownSync(MonitorId)("github");

describe("formatAlert", () => {
  it("покрывает все шесть вариантов", () => {
    expect(formatAlert(new NetworkError({ cause: "x", url: "a" }))).toContain("[network]");
    expect(
      formatAlert(new HttpStatusError({ cause: "x", expected: 200, status: 500, url: "a" })),
    ).toContain("[http]");
    expect(formatAlert(new BodyContractError({ cause: "x", url: "a" }))).toContain("[body]");
    expect(formatAlert(new TimeoutError({ timeoutMs: 100, url: "a" }))).toContain("[timeout]");
    expect(formatAlert(new ConfigParseError({ cause: "x", path: "/x" }))).toContain("[config]");
    expect(formatAlert(new StorageError({ cause: "x" }))).toContain("[storage]");
  });
});

describe("recordResult", () => {
  it("строит ProbeSuccess из успешного probe", async () => {
    const ok = Effect.succeed({ elapsedMs: 10, status: 200, url: "https://a" });
    const event = await Effect.runPromise(recordResult(id, ok));
    expect(event._tag).toBe("ProbeSuccess");
    if (event._tag === "ProbeSuccess") {
      expect(event.status).toBe(200);
    }
  });

  it('строит ProbeFailure с reason="network" из NetworkError', async () => {
    const fail = Effect.fail(new NetworkError({ cause: "x", url: "https://a" }));
    const event = await Effect.runPromise(recordResult(id, fail));
    expect(event._tag).toBe("ProbeFailure");
    if (event._tag === "ProbeFailure") {
      expect(event.reason).toBe("network");
    }
  });

  it('строит ProbeFailure с reason="timeout" из TimeoutError', async () => {
    const fail = Effect.fail(new TimeoutError({ timeoutMs: 100, url: "https://a" }));
    const event = await Effect.runPromise(recordResult(id, fail));
    expect(event._tag).toBe("ProbeFailure");
    if (event._tag === "ProbeFailure") {
      expect(event.reason).toBe("timeout");
    }
  });
});

describe("divideOrDie", () => {
  it("die на нулевом делителе ловится через Effect.exit + Cause.isDie", async () => {
    const exit = await Effect.runPromise(Effect.exit(divideOrDie(1, 0)));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(Cause.isDie(exit.cause)).toBe(true);
    }
  });

  it("die на нулевом делителе ловится через Effect.sandbox + Effect.catchTag", () => {
    const sandboxed = Effect.sandbox(divideOrDie(1, 0)).pipe(
      Effect.catchTag("Die", (e) => Effect.succeed(e._tag)),
    );
    const t = Effect.runSync(sandboxed);
    expect(t).toBe("Die");
  });

  it("die на нулевом делителе ловится через Effect.sandbox + Effect.catchTag 2", () => {
    const sandboxed = Effect.sandbox(divideOrDie(1, 0)).pipe(
      Effect.catchTag("Die", (e) => {
        expect(e.defect).toBeInstanceOf(Error);

        return Effect.succeed(e._tag);
      }),
    );
    expect(Effect.runSync(sandboxed)).toBe("Die");
  });

  it("die на нулевом делителе ловится через Effect.catchAllCause", () => {
    const program = divideOrDie(1, 0).pipe(
      Effect.catchAllCause((cause) =>
        Effect.sync(() => {
          expect(Cause.isDie(cause)).toBe(true);
        }),
      ),
    );

    Effect.runSync(program);
  });
});
