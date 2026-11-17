import { describe, expect, it, vi } from "vitest";
import { debounce, describeError, settingsEqual, PRESET_LABELS } from "./logic";

describe("describeError", () => {
  it("maps known codes to plain text", () => {
    expect(describeError("dll_not_found")).toMatch(/Lossless Scaling/);
    expect(describeError("install_url_unknown")).toMatch(/not available yet/i);
    expect(describeError("not_confirmed")).toMatch(/confirm/i);
  });
  it("passes unknown strings through and handles non-strings", () => {
    expect(describeError("weird thing")).toBe("weird thing");
    expect(describeError(new Error("boom"))).toBe("boom");
    expect(describeError(undefined)).toMatch(/something went wrong/i);
  });
});

describe("debounce", () => {
  it("coalesces rapid calls to the last value", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d(1);
    d(2);
    d(3);
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
    vi.useRealTimers();
  });
  it("cancel stops a pending call", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("settingsEqual", () => {
  it("ignores key order", () => {
    expect(settingsEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(settingsEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe("PRESET_LABELS", () => {
  it("has the three presets", () => {
    expect(Object.keys(PRESET_LABELS)).toEqual(["battery", "balanced", "quality"]);
  });
});
