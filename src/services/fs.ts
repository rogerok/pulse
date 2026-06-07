import { Effect } from "effect";
import * as fs from "node:fs/promises";

import { StorageError } from "../errors.ts";

export class FsService extends Effect.Service<FsService>()("Pulse/FsService", {
  succeed: {
    append: (path: string) =>
      Effect.gen(function* () {
        const handle = yield* Effect.tryPromise({
          try: () => fs.open(path, "a"),
          catch: (cause) => new StorageError({ cause }),
        });

        return {
          close: () =>
            Effect.tryPromise({
              try: async () => {
                await handle.close();
              },
              catch: (cause) => new StorageError({ cause }),
            }),

          write: (line: string) =>
            Effect.tryPromise({
              try: async () => {
                await handle.write(line);
              },
              catch: (cause) => new StorageError({ cause }),
            }),
        };
      }),

    readText: (path: string) =>
      Effect.tryPromise({
        try: () => fs.readFile(path, "utf-8"),
        catch: (cause) => new StorageError({ cause }),
      }),
  },
}) {}

export const FsServiceLive = FsService.Default;
