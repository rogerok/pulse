import { describe, expect, it } from "vitest";

import { hello } from "../src/index";

describe("pulse", () => {
  it("exports effect value", () => {
    expect(hello).toBeDefined();
  });
});
