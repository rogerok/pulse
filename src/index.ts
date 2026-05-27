import { Effect } from "effect";

import { probe } from "./probe.ts";

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
const url = args[1];

if (args[0] !== "url" || url === undefined) {
  console.error("usage: pnpm start url <https://...>");
  process.exit(1);
}

const program = Effect.gen(function* () {
  const result = yield* probe(url);
  yield* Effect.sync(() => {
    console.log(`status ${result.status} in ${result.elapsedMs} ms`);
  });
});

Effect.runPromise(program).catch((cause: unknown) => {
  console.error(cause);
  process.exit(2);
});

Effect.runFork(program);

Effect.runSync(program);
