import { Data } from "effect";

export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly cause: unknown;
  readonly url: string;
}> {}

export class ConfigParseError extends Data.TaggedError("ConfigParseError")<{
  readonly cause: unknown;
  readonly path: string;
}> {}
