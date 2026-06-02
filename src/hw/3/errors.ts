import { Data } from "effect";

export class ApiHttpError extends Data.TaggedError("ApiHttpError")<{
  readonly cause: unknown;
  readonly status: number;
  readonly url: string;
}> {}

export class ApiNetworkError extends Data.TaggedError("ApiNetworkError")<{
  readonly cause: unknown;
  readonly url: string;
}> {}

export class ApiParseError extends Data.TaggedError("ApiParseError")<{
  readonly cause: unknown;
  readonly url: string;
}> {}

export type ApiError = ApiHttpError | ApiNetworkError | ApiParseError;
