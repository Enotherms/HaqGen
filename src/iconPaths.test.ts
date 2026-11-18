import { describe, expect, it } from "vitest";
import logo from "../assets/logo.svg?raw";
import { ICON_PATHS } from "./iconPaths";

describe("HaqGen icon", () => {
  it("draws H and G as two strokes", () => {
    expect(ICON_PATHS).toHaveLength(2);
  });
  it("matches the README logo exactly", () => {
    for (const d of ICON_PATHS) expect(logo).toContain(`d="${d}"`);
  });
});

function outline(d: string) {
  const xs: number[] = [];
  const ys: number[] = [];
  let x = 0;
  let y = 0;
  for (const [, cmd, args] of d.matchAll(/([MVHA])([^MVHA]*)/g)) {
    const n = (args.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    if (cmd === "M") [x, y] = n;
    if (cmd === "V") y = n[0];
    if (cmd === "H") x = n[0];
    if (cmd === "A") {
      const r = n[0];
      const [nx, ny] = [n[5], n[6]];
      const cy = y;
      const left = Math.min(x, nx);
      const right = Math.max(x, nx);
      xs.push(left, right);
      ys.push(n[4] === 0 && nx < x ? cy - r : cy + r);
      [x, y] = [nx, ny];
    }
    xs.push(x);
    ys.push(y);
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

describe("HaqGen mark proportions", () => {
  const boxes = ICON_PATHS.map(outline);
  const all = {
    x0: Math.min(...boxes.map((b) => b.x0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
  it("draws H and G in identical boxes", () => {
    const [h, g] = boxes;
    expect(h.x1 - h.x0).toBeCloseTo(g.x1 - g.x0, 2);
    expect(h.y1 - h.y0).toBeCloseTo(g.y1 - g.y0, 2);
  });
  it("is a square block centred on the 24×24 grid", () => {
    expect(all.x1 - all.x0).toBeCloseTo(all.y1 - all.y0, 2);
    expect((all.x0 + all.x1) / 2).toBeCloseTo(12, 2);
    expect((all.y0 + all.y1) / 2).toBeCloseTo(12, 2);
  });
  it("gives the logo equal padding on all four sides", () => {
    const m = logo.match(/translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)/);
    expect(m).not.toBeNull();
    const [tx, ty, s] = [Number(m![1]), Number(m![2]), Number(m![3])];
    const half = 2.3 / 2;
    const left = tx + s * (all.x0 - half);
    const right = 128 - (tx + s * (all.x1 + half));
    const top = ty + s * (all.y0 - half);
    const bottom = 128 - (ty + s * (all.y1 + half));
    for (const p of [right, top, bottom]) expect(p).toBeCloseTo(left, 1);
  });
});
