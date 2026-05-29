import { Effect, Either, ParseResult, Schema } from "effect";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { decodeFromFile, Interval, MonitorDefaults } from "../src/config.ts";
import { ConfigParseError } from "../src/errors.ts";
describe("decodeFromFile", () => {
  it("decodes a valid config file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pulse-config-"));
    const path = join(dir, "pulse.config.json");

    await writeFile(
      path,
      JSON.stringify({
        monitors: [
          {
            id: "github-www",
            interval: "30s",
            url: "https://github.com",
          },
        ],
      }),
      "utf-8",
    );

    const config = await Effect.runPromise(decodeFromFile(path));
    expect(config).toMatchObject({
      defaults: {
        interval: 30_000,
        retries: 0,
        timeout: 5000,
      },
      monitors: [
        {
          expect: { status: 200 },
          id: "github-www",
          interval: 30_000,
          url: "https://github.com",
        },
      ],
    });
  });

  it("returns a parse error with the failing field path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pulse-config-"));
    const path = join(dir, "pulse.config.json");

    await writeFile(
      path,
      JSON.stringify({
        monitors: [
          {
            id: "github-www",
            interval: "30wat",
            url: "https://github.com",
          },
        ],
      }),
      "utf-8",
    );

    const result = await Effect.runPromise(Effect.either(decodeFromFile(path)));
    expect(Either.isLeft(result)).toBe(true);

    if (Either.isRight(result)) {
      throw new Error("expected decodeFromFile to fail");
    }

    expect(result.left).toBeInstanceOf(ConfigParseError);
    const issues = ParseResult.ArrayFormatter.formatErrorSync(
      result.left.cause as ParseResult.ParseError,
    );
    expect(issues.some((issue) => issue.path.join(".") === "monitors.0.interval")).toBe(true);
  });
});

describe("Interval", () => {
  it.each([
    ["500ms", 500],
    ["10s", 10_000],
    ["5m", 300_000],
  ])("decodes %s into milliseconds", (encoded, decoded) => {
    expect(Schema.decodeUnknownSync(Interval)(encoded)).toBe(decoded);
  });

  it.each(["", "30x", "5 minutes"])("rejects invalid interval %s", (encoded) => {
    const result = Schema.decodeUnknownEither(Interval)(encoded);
    expect(Either.isLeft(result)).toBe(true);
  });

  it.each(["500ms", "10s", "1h"])("round-trips %s", (encoded) => {
    const decoded = Schema.decodeUnknownSync(Interval)(encoded);
    expect(Schema.encodeSync(Interval)(decoded)).toBe(encoded);
  });
});

describe("MonitorDefaults", () => {
  it("fills defaults for an empty object", () => {
    expect(Schema.decodeUnknownSync(MonitorDefaults)({})).toEqual({
      interval: 30_000,
      retries: 0,
      timeout: 5000,
    });
  });
});
