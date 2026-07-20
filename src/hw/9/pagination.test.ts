import { describe, it } from "@effect/vitest";
import { Chunk, Effect, Ref, Stream } from "effect";

import { fetchAllEventsFromApi, fetchPage } from "./pagination.ts";

describe("pagination", () => {
  it.effect("collects all pages in order and stops after last page", () =>
    Effect.gen(function* () {
      const counter = yield* Ref.make(0);

      const fetchWithCounter = (page: number) =>
        Effect.gen(function* () {
          yield* Ref.update(counter, (c) => c + 1);

          return yield* fetchPage(page);
        });

      const result = yield* fetchAllEventsFromApi(fetchWithCounter).pipe(Stream.runCollect);
      const arr = Chunk.toReadonlyArray(result);

      const count = yield* Ref.get(counter);
      expect(count).toBe(5);
      expect(arr.length).toBe(50);
      expect(arr.map((e) => e.id)).toEqual(Array.from({ length: 50 }).map((_, i) => i + 1));
    }),
  );
});
