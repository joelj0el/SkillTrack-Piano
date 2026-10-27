import { describe, expect, it } from "vitest";
import { VERSION_NUCLEO } from "./index.ts";

describe("versión del núcleo", () => {
  it("PU-core-00: el núcleo expone su versión en formato semver", () => {
    expect(VERSION_NUCLEO).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
