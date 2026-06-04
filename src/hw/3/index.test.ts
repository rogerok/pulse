import { Effect } from "effect";

import { ApiNetworkError, ApiParseError } from "./errors.ts";
import { fetchJson } from "./index.ts";
import { Posts } from "./schemas.ts";

const url = "https://example.com/posts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPosts", () => {
  it("decode posts from a successful response", async () => {
    const posts = [
      {
        body: "Post body",
        id: 1,
        title: "Post title",
        userId: 1,
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(Response.json(posts));
    vi.stubGlobal("fetch", fetchMock);

    const result = await Effect.runPromise(fetchJson(url, Posts));

    expect(result).toEqual(posts);
    expect(fetchMock).toHaveBeenCalledWith(url, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      signal: expect.any(AbortSignal),
    });
  });

  it("fails with ApiNetworkError when fetch rejects", async () => {
    const cause = new Error("connection failed");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause));

    const error = await Effect.runPromise(Effect.flip(fetchJson(url, Posts)));

    expect(error).toBeInstanceOf(ApiNetworkError);
    expect(error.cause).toBe(cause);
    expect(error.url).toBe(url);
  });

  it("fails with ApiParseError when response body is invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("not json", {
          status: 200,
        }),
      ),
    );

    const err = await Effect.runPromise(Effect.flip(fetchJson(url, Posts)));

    expect(err).toBeInstanceOf(ApiParseError);
    expect(err.url).toBe(url);
  });
});
