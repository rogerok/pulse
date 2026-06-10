import { Effect, ParseResult, Schema } from "effect";
import { readFile } from "node:fs/promises";

import { IntervalDefault, RetriesDefault, TimeoutDefault } from "./constants.ts";
import { ConfigParseError } from "./errors.ts";

export const MonitorId = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*$/, { identifier: "MonitorId" }),
  Schema.brand("MonitorId"),
);
export type MonitorId = Schema.Schema.Type<typeof MonitorId>;

export const EventId = Schema.String.pipe(
  Schema.pattern(
    /^\d+-\d{4}$/,

    { identifier: "EventId" },
  ),
  Schema.brand("EventId"),
);
export type EventId = Schema.Schema.Type<typeof EventId>;

export const Url = Schema.String.pipe(
  Schema.pattern(/^https?:\/\//, { identifier: "Url" }),
  Schema.brand("Url"),
);
export type Url = Schema.Schema.Type<typeof Url>;

export const IntervalMs = Schema.Number.pipe(
  Schema.int(),
  Schema.between(100, 26 * 3_600_000),
  Schema.brand("Interval"),
);

export const Interval = Schema.transformOrFail(Schema.String, IntervalMs, {
  decode: (input, _options, ast) => {
    const match = /^(\d+)(ms|s|m|h)$/.exec(input);

    if (match === null) {
      return ParseResult.fail(
        new ParseResult.Type(ast, input, `ожидается формат "30s", "1m", "2h", "500ms"`),
      );
    }

    const value = Number(match[1]);
    const unit = match[2];
    const multiplier = unit === "h" ? 3_600_000 : unit === "m" ? 60_000 : unit === "s" ? 1000 : 1;

    return ParseResult.succeed(IntervalMs.make(value * multiplier));
  },
  encode: (millis) => {
    if (millis % 3_600_000 === 0) return ParseResult.succeed(`${millis / 3_600_000}h`);
    if (millis % 60_000 === 0) return ParseResult.succeed(`${millis / 60_000}m`);
    if (millis % 1000 === 0) return ParseResult.succeed(`${millis / 1000}s`);

    return ParseResult.succeed(`${millis}ms`);
  },
  strict: true,
});
export type Interval = Schema.Schema.Type<typeof Interval>;

const StatusDefault = 200;
export const Expect = Schema.Struct({
  status: Schema.optionalWith(Schema.Number, { default: () => StatusDefault }),
});
export type Expect = Schema.Schema.Type<typeof Expect>;

export const Monitor = Schema.Struct({
  expect: Schema.optionalWith(Expect, { default: () => ({ status: StatusDefault }) }),
  id: MonitorId,
  interval: Interval,
  url: Url,
});
export type Monitor = Schema.Schema.Type<typeof Monitor>;

export const MonitorDefaults = Schema.Struct({
  interval: Schema.optionalWith(Schema.Number, { default: () => IntervalDefault }),
  retries: Schema.optionalWith(Schema.Number, { default: () => RetriesDefault }),
  timeout: Schema.optionalWith(Schema.Number, { default: () => TimeoutDefault }),
});
export type MonitorDefaults = Schema.Schema.Type<typeof MonitorDefaults>;

export const PulseConfig = Schema.Struct({
  defaults: Schema.optionalWith(MonitorDefaults, {
    default: () => ({
      interval: IntervalDefault,
      retries: RetriesDefault,
      timeout: TimeoutDefault,
    }),
  }),
  monitors: Schema.Array(Monitor).pipe(Schema.minItems(1)),
});
export type PulseConfig = Schema.Schema.Type<typeof PulseConfig>;

export const decodeFromFile = (path: string): Effect.Effect<PulseConfig, ConfigParseError> =>
  Effect.gen(function* () {
    const text = yield* Effect.tryPromise({
      try: () => readFile(path, "utf-8"),
      catch: (cause) => new ConfigParseError({ cause, path }),
    });

    const json = yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: (cause) => new ConfigParseError({ cause, path }),
    });

    return yield* Schema.decodeUnknown(PulseConfig)(json).pipe(
      Effect.mapError((cause) => new ConfigParseError({ cause, path })),
    );
  });
