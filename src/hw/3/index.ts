import { Effect, Schema } from "effect";

import { ApiError, ApiHttpError, ApiNetworkError, ApiParseError } from "./errors.ts";
import { Posts, type PostsType } from "./schemas.ts";

export const postsUrl = "https://jsonplaceholder.typicode.com/posts";

export const fetchPosts = (url: string): Effect.Effect<PostsType, ApiError> =>
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

    return yield* Schema.decodeUnknown(Posts)(json).pipe(
      Effect.mapError((cause) => new ApiParseError({ cause, url })),
    );
  });
