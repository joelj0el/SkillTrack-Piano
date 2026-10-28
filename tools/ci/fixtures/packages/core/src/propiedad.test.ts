import fc from "fast-check";
import { it } from "vitest";
import { limpio } from "./limpio.ts";

it("propiedad de ejemplo", () => {
  fc.assert(fc.property(fc.integer(), (n) => n + limpio - limpio === n));
});
