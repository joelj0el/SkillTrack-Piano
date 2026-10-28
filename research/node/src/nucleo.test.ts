import { describe, expect, it } from "vitest";
import { versionNucleo } from "./index.ts";

describe("research/node", () => {
  it("PU-research-01: usa el núcleo a través del workspace", () => {
    expect(versionNucleo()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
