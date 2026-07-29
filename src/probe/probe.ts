import { Effect, Either } from "effect";
import { getDomain } from "tldts";

import { type MonitorId } from "../config.ts";
import { NetworkError } from "../errors.ts";
import { DnsCache } from "../services/dns.ts";
import { HttpService } from "../services/http.ts";
import { MonitorEvents } from "../services/monitor-events.ts";
import { Whois } from "../services/whois.ts";

export type ProbeResult = {
  readonly elapsedMs: number;
  readonly status: number;
  readonly url: string;
};

type ProbeOutcome =
  | {
      readonly _tag: "Completed";
      readonly result: ProbeResult;
    }
  | {
      readonly _tag: "Skipped";
      readonly reason: "dns" | "expired";
    };

export const probe = (target: {
  host: string;
  id: MonitorId;
  url: string;
}): Effect.Effect<ProbeOutcome, NetworkError, DnsCache | HttpService | MonitorEvents | Whois> =>
  Effect.gen(function* () {
    const httpService = yield* HttpService;
    const dns = yield* DnsCache;
    const whois = yield* Whois;
    const bus = yield* MonitorEvents;
    const startedAt = yield* Effect.sync(() => Date.now());

    const ip = yield* dns.lookup(target.host).pipe(Effect.either);

    if (Either.isLeft(ip)) {
      yield* bus.publish({
        _tag: "ProbeSkipped",
        monitorId: target.id,
        reason: "dns",
      });
      return { _tag: "Skipped", reason: "dns" } satisfies ProbeOutcome;
    }

    const domain = getDomain(target.host);

    if (domain) {
      const whoIsRecord = yield* whois.lookup(domain).pipe(Effect.either);

      if (Either.isRight(whoIsRecord) && whoIsRecord.right.expiresAt < new Date()) {
        yield* bus.publish({ _tag: "ProbeSkipped", monitorId: target.id, reason: "expired" });
        return { _tag: "Skipped", reason: "expired" } satisfies ProbeOutcome;
      }
    }

    const controller = yield* Effect.acquireRelease(
      Effect.sync(() => new AbortController()),
      (ac) =>
        Effect.sync(() => {
          ac.abort();
        }),
    );

    const response = yield* httpService.get(target.url, controller.signal);
    const elapsedMs = yield* Effect.sync(() => Date.now() - startedAt);
    return {
      _tag: "Completed",
      result: { elapsedMs, status: response.status, url: target.url },
    } satisfies ProbeOutcome;
  }).pipe(Effect.scoped);
