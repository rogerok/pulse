import { Cache, Data, Duration, Effect, Schema } from "effect";

export class WhoisError extends Data.TaggedError("WhoisError")<{
  readonly cause: unknown;
  readonly domain: string;
}> {}

export class WhoisNetworkError extends Data.TaggedError("WhoisNetworkError")<{
  readonly cause: unknown;
  readonly domain: string;
}> {}

export class WhoisHttpError extends Data.TaggedError("WhoisHttpError")<{
  readonly domain: string;
  readonly status: number;
}> {}

export class WhoisParseError extends Data.TaggedError("WhoisParseError")<{
  readonly cause: unknown;
  readonly domain: string;
}> {}

export type WhoisClientError = WhoisHttpError | WhoisNetworkError | WhoisParseError;

export const WhoisRecord = Schema.Struct({
  expiresAt: Schema.DateFromString,
  registrar: Schema.String.pipe(Schema.minLength(1)),
});
export type WhoisRecord = Schema.Schema.Type<typeof WhoisRecord>;

const RdapEvent = Schema.Struct({
  eventAction: Schema.String,
  eventDate: Schema.String,
});

const VCardField = Schema.Tuple(Schema.String, Schema.Unknown, Schema.String, Schema.Unknown);

const RdapEntity = Schema.Struct({
  roles: Schema.optionalWith(Schema.Array(Schema.String), {
    default: () => [],
  }),
  vcardArray: Schema.optional(Schema.Tuple(Schema.Literal("vcard"), Schema.Array(VCardField))),
});

const RdapResponse = Schema.Struct({
  entities: Schema.optionalWith(Schema.Array(RdapEntity), {
    default: () => [],
  }),
  events: Schema.optionalWith(Schema.Array(RdapEvent), {
    default: () => [],
  }),
});

export class WhoisClient extends Effect.Service<WhoisClient>()("Pulse/WhoisClient", {
  succeed: {
    fetch: (domain: string) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: (signal) =>
            fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
              signal,
            }),
          catch: (cause) => new WhoisNetworkError({ cause, domain }),
        });

        if (!response.ok) {
          return yield* new WhoisHttpError({
            domain,
            status: response.status,
          });
        }

        const json: unknown = yield* Effect.tryPromise({
          try: () => response.json(),
          catch: (cause) => new WhoisParseError({ cause, domain }),
        });
        const rdap = yield* Schema.decodeUnknown(RdapResponse)(json).pipe(
          Effect.mapError((cause) => new WhoisParseError({ cause, domain })),
        );

        const expiration = rdap.events.find(
          (event) => event.eventAction === "expiration",
        )?.eventDate;
        const registrarEntity = rdap.entities.find((entity) => entity.roles.includes("registrar"));
        const registrar = registrarEntity?.vcardArray?.[1].find((field) => field[0] === "fn")?.[3];

        return yield* Schema.decodeUnknown(WhoisRecord)({
          expiresAt: expiration,
          registrar,
        }).pipe(Effect.mapError((cause) => new WhoisParseError({ cause, domain })));
      }),
  },
}) {}

export class Whois extends Effect.Service<Whois>()("Pulse/Whois", {
  dependencies: [WhoisClient.Default],
  effect: Effect.gen(function* () {
    const client = yield* WhoisClient;
    const cache = yield* Cache.make({
      capacity: 256,
      lookup: (domain: string) =>
        client.fetch(domain).pipe(Effect.mapError((cause) => new WhoisError({ cause, domain }))),
      timeToLive: Duration.hours(24),
    });

    return {
      lookup: (domain: string) => cache.get(domain),
      refresh: (domain: string) => cache.refresh(domain),
    };
  }),
}) {}
