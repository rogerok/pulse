import { Effect } from "effect";

const primary = Effect.tryPromise(() =>
  fetch("https://jsonplaceholder.typicode.com/posts/1/comments"),
).pipe(Effect.onInterrupt(() => Effect.log("primary was interrupted")));

const secondary = Effect.tryPromise(() =>
  fetch("https://jsonplaceholder.typicode.com/todos/2"),
).pipe(Effect.onInterrupt(() => Effect.log("secondary was interrupted")));

const program = Effect.race(primary, secondary);

void Effect.runPromise(program);
