import { describe, it, expect } from "vitest";
import { splitPassage, missingLength } from "@/lib/passage";

describe("splitPassage", () => {
  it("returns inline=true when {} count matches blank count", () => {
    const r = splitPassage("a {} b {} c", 2);
    expect(r.inline).toBe(true);
    expect(r.segments).toEqual(["a ", " b ", " c"]);
  });

  it("returns inline=false when {} count does not match", () => {
    const r = splitPassage("legacy di_____ text", 1);
    expect(r.inline).toBe(false);
    expect(r.segments).toEqual(["legacy di_____ text"]);
  });
});

describe("missingLength", () => {
  it("counts the letters the user must supply", () => {
    expect(missingLength("conv", "converting")).toBe(6);
    expect(missingLength("fu", "fuel")).toBe(2);
  });

  it("never returns less than 1", () => {
    expect(missingLength("diverse", "diverse")).toBe(1);
  });
});
