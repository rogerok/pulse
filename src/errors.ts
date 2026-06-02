import { Data } from "effect";

export class ConfigParseError extends Data.TaggedError("ConfigParseError")<{
  readonly cause: unknown;
  readonly path: string;
}> {}

export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly cause: unknown;
  readonly url: string;
}> {}

export class HttpStatusError extends Data.TaggedError("HttpStatusError")<{
  readonly cause: unknown;
  readonly expected: number;
  readonly status: number;
  readonly url: string;
  readonly body?: string;
}> {}

export class BodyContractError extends Data.TaggedError("BodyContractError")<{
  readonly cause: unknown;
  readonly url: string;
}> {}

export class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly timeoutMs: number;
  readonly url: string;
}> {}

export class StorageError extends Data.TaggedError("StorageError")<{
  readonly cause: unknown;
}> {}

export type PulseError =
  | BodyContractError
  | ConfigParseError
  | HttpStatusError
  | NetworkError
  | StorageError
  | TimeoutError;
