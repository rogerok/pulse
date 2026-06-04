import { Schema } from "effect";

export const Url = Schema.String.pipe(
  Schema.pattern(/^https?:\/\//, { identifier: "Url" }),
  Schema.brand("Url"),
);
export type Url = Schema.Schema.Type<typeof Url>;

export const UserId = Schema.Number.pipe(Schema.nonNegative({ identifier: "UserId" }));
export type UserId = Schema.Schema.Type<typeof UserId>;

export const PostId = Schema.Number.pipe(Schema.nonNegative({ identifier: "PostId" }));
export type PostId = Schema.Schema.Type<typeof PostId>;

export const Post = Schema.Struct({
  body: Schema.String,
  id: PostId,
  title: Schema.String,
  userId: UserId,
});
export type PostType = Schema.Schema.Type<typeof Post>;

export const Posts = Schema.Array(Post);
export type PostsType = Schema.Schema.Type<typeof Posts>;
