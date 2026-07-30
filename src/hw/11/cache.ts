import { Context, Data, Cache as EffectCache } from "effect";

export type HttpResponse = {
  readonly body: string;
  readonly status: number;
};

export class NoCacheError extends Data.TaggedError("NoCacheError")<{ readonly url: string }> {}

export class MyCache extends Context.Tag("HW11/Cache")<
  MyCache,
  EffectCache.Cache<string, HttpResponse, NoCacheError>
>() {}
