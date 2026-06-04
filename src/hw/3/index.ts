import { Effect, Schema } from "effect";

import { ApiError, ApiHttpError, ApiNetworkError, ApiParseError } from "./errors.ts";

export const fetchJson = <A, I>(
  url: string,
  schema: Schema.Schema<A, I>,
): Effect.Effect<A, ApiError> =>
  Effect.gen(function* () {
    const resp = yield* Effect.tryPromise({
      try: (signal) => fetch(url, { signal }),
      catch: (cause) => new ApiNetworkError({ cause, url }),
    });

    if (!resp.ok) {
      return yield* new ApiHttpError({ cause: "Wrong status", status: resp.status, url });
    }

    const json = yield* Effect.tryPromise({
      try: () => resp.json() as Promise<unknown>,
      catch: (cause) => new ApiParseError({ cause, url }),
    });

    return yield* Schema.decodeUnknown(schema)(json).pipe(
      Effect.mapError((cause) => new ApiParseError({ cause, url })),
    );
  });
