import { Effect } from "effect";

import { NetworkError } from "../errors.ts";

export class HttpService extends Effect.Service<HttpService>()("Pulse/HttpService", {
  effect: Effect.gen(function* () {
    yield* Effect.logInfo("HttpService constructed");

    return {
      get: (url: string) =>
        Effect.tryPromise({
          try: (signal) =>
            fetch(url, {
              signal,
            }).then((r) => ({
              body: "",
              status: r.status,
            })),
          catch: (cause) => new NetworkError({ cause, url }),
        }),

      post: (url: string, body: unknown) =>
        Effect.tryPromise({
          try: (signal) =>
            fetch(url, {
              body: JSON.stringify(body),
              method: "POST",
              signal,
            }).then((r) => ({
              body: "",
              status: r.status,
            })),

          catch: (cause) => new NetworkError({ cause, url }),
        }),
    };
  }),
}) {}

export const HttpLive = HttpService.Default;
