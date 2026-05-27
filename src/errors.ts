import { Data } from "effect";

export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly cause: unknown;
  readonly url: string;
}> {}
