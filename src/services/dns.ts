import { Cache, Data, Duration, Effect, Either, Request, RequestResolver } from "effect";
import { promises as dnsLib } from "node:dns";

export class DnsError extends Data.TaggedError("DnsError")<{
  readonly cause: unknown;
  readonly host: string;
}> {}

interface DnsLookup extends Request.Request<string, DnsError> {
  readonly _tag: "DnsLookup";
  readonly host: string;
}

const DnsLookup = Request.tagged<DnsLookup>("DnsLookup");

const DnsLookupResolver = RequestResolver.makeBatched((requests: ReadonlyArray<DnsLookup>) =>
  Effect.gen(function* () {
    const hosts = requests.map((r) => r.host);
    const result = yield* Effect.tryPromise({
      try: () =>
        Promise.all(
          hosts.map((h) =>
            dnsLib.resolve4(h).then(
              (ips) => [h, ips[0] ?? null] as const,
              () => [h, null] as const,
            ),
          ),
        ),
      catch: (cause) => new DnsError({ cause, host: hosts[0] ?? "" }),
    }).pipe(Effect.either);

    if (Either.isLeft(result)) {
      yield* Effect.forEach(
        requests,
        (req) => Request.completeEffect(req, Effect.fail(result.left)),
        { discard: true },
      );
      return;
    }

    const map = new Map(result.right);

    yield* Effect.forEach(
      requests,
      (req) => {
        const ip = map.get(req.host);

        return Request.completeEffect(
          req,
          ip == null
            ? Effect.fail(new DnsError({ cause: "NXDOMAIN", host: req.host }))
            : Effect.succeed(ip),
        );
      },
      {
        discard: true,
      },
    );
  }),
);

const BatchedDnsResolver = RequestResolver.batchN(DnsLookupResolver, 8);

export const dnsLookup = (host: string) => Effect.request(DnsLookup({ host }), BatchedDnsResolver);

export type DnsLookupFunction = (host: string) => Effect.Effect<string, DnsError>;

export const makeDnsCache = (lookup: DnsLookupFunction) =>
  Effect.gen(function* () {
    const cache = yield* Cache.make({
      capacity: 1024,
      lookup,
      timeToLive: Duration.minutes(5),
    });

    return {
      invalidate: (host: string) => cache.invalidate(host),
      lookup: (host: string) => cache.get(host),
      refresh: (host: string) => cache.refresh(host),
    };
  });

export class DnsCache extends Effect.Service<DnsCache>()("Pulse/DnsCache", {
  effect: makeDnsCache(dnsLookup),
}) {}
