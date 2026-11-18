import { describe, expect, it } from "vitest";
import { C, contrast, PAIRS } from "./colors";

describe("colour palette", () => {
  it("uses Steam's blue as the single accent", () => {
    expect(C.accentFocus).toBe("#1a9fff");
  });
  it("meets WCAG 2.2 contrast: 4.5:1 for text, 3:1 for borders and icons", () => {
    for (const [name, fg, bg, min] of PAIRS) {
      expect({ name, ok: contrast(fg, bg) >= min }).toEqual({ name, ok: true });
    }
  });
  it("computes contrast correctly", () => {
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
  });
});
