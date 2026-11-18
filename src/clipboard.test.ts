import { describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

function fakeDoc(execResult: boolean | "throw") {
  const removed: unknown[] = [];
  const el = { value: "", style: {} as Record<string, string>, focus: vi.fn(), select: vi.fn() };
  const doc = {
    createElement: vi.fn(() => el),
    body: { appendChild: vi.fn(), removeChild: vi.fn((x: unknown) => removed.push(x)) },
    execCommand: vi.fn(() => {
      if (execResult === "throw") throw new Error("blocked");
      return execResult;
    }),
  };
  return { doc, el, removed };
}

describe("copyText", () => {
  it("uses the copy command first and cleans up", async () => {
    const { doc, el, removed } = fakeDoc(true);
    const clip = { writeText: vi.fn() };
    expect(await copyText("abc", doc as never, clip)).toBe(true);
    expect(el.value).toBe("abc");
    expect(el.select).toHaveBeenCalled();
    expect(clip.writeText).not.toHaveBeenCalled();
    expect(removed).toEqual([el]);
  });
  it("falls back to the clipboard API", async () => {
    const { doc, removed } = fakeDoc(false);
    const clip = { writeText: vi.fn(async () => {}) };
    expect(await copyText("abc", doc as never, clip)).toBe(true);
    expect(clip.writeText).toHaveBeenCalledWith("abc");
    expect(removed).toHaveLength(1);
  });
  it("reports failure when both methods fail, still cleaning up", async () => {
    const { doc, removed } = fakeDoc("throw");
    const clip = { writeText: vi.fn(async () => { throw new Error("denied"); }) };
    expect(await copyText("abc", doc as never, clip)).toBe(false);
    expect(removed).toHaveLength(1);
  });
});

describe("copyText focus", () => {
  it("gives focus back to the control that had it", async () => {
    const { doc } = fakeDoc(true);
    const previous = { focus: vi.fn() };
    (doc as Record<string, unknown>).activeElement = previous;
    await copyText("abc", doc as never, { writeText: vi.fn() });
    expect(previous.focus).toHaveBeenCalled();
  });
});
