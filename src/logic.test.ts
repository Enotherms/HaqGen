import { describe, expect, it, vi } from "vitest";
import { debounce, describeError, settingsEqual, PRESET_LABELS } from "./logic";

describe("describeError", () => {
  it("maps known codes to plain text", () => {
    expect(describeError("dll_not_found")).toMatch(/Lossless Scaling/);
    expect(describeError("install_url_unknown")).toMatch(/not available yet/i);
    expect(describeError("not_confirmed")).toMatch(/confirm/i);
  });
  it("adds the detail for install_failed", () => {
    expect(describeError("install_failed", "Checksum mismatch")).toMatch(/Checksum mismatch/);
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

import { buildGameOptions, gameName, gamesCountLabel, parseStoredAppId } from "./logic";

describe("buildGameOptions", () => {
  const games = [
    { app_id: 1, name: "Alpha" },
    { app_id: 2, name: "Beta" },
  ];
  it("returns a flat list of single options (Steam's dropdown cannot select inside groups)", () => {
    const out = buildGameOptions(games, null);
    expect(out).toEqual([
      { data: 1, label: "Alpha" },
      { data: 2, label: "Beta" },
    ]);
    expect(out.every((o) => !("options" in o))).toBe(true);
  });
  it("puts the running game first, marked, without duplicating it", () => {
    expect(buildGameOptions(games, { appId: 2, name: "Beta" })).toEqual([
      { data: 2, label: "Beta · Running" },
      { data: 1, label: "Alpha" },
    ]);
  });
  it("shows a running game that is not installed through Steam", () => {
    const out = buildGameOptions(games, { appId: 99, name: "Shortcut" });
    expect(out[0]).toEqual({ data: 99, label: "Shortcut · Running" });
    expect(out).toHaveLength(3);
  });
  it("returns nothing when nothing is installed or running", () => {
    expect(buildGameOptions([], null)).toEqual([]);
  });
});

describe("gamesCountLabel", () => {
  it("describes how many games were found", () => {
    expect(gamesCountLabel(0)).toBe("No installed games found");
    expect(gamesCountLabel(1)).toBe("1 installed game");
    expect(gamesCountLabel(3)).toBe("3 installed games");
  });
});

describe("gameName", () => {
  it("finds names from the list or the running game", () => {
    const games = [{ app_id: 1, name: "Alpha" }];
    expect(gameName(games, null, 1)).toBe("Alpha");
    expect(gameName(games, { appId: 9, name: "Run" }, 9)).toBe("Run");
    expect(gameName(games, null, 5)).toBeNull();
  });
});

describe("parseStoredAppId", () => {
  it("accepts positive integers only", () => {
    expect(parseStoredAppId("123")).toBe(123);
    expect(parseStoredAppId("abc")).toBeNull();
    expect(parseStoredAppId("-5")).toBeNull();
    expect(parseStoredAppId(null)).toBeNull();
  });
});

import { frameLimitTip, PRESET_ORDER, RESTART, restartBanner, summaryLine } from "./logic";

describe("RESTART notes", () => {
  it("uses the fixed wording", () => {
    expect(RESTART).toEqual({
      instant: "Applies instantly",
      game: "Restart the game to apply",
      none: "No restart needed",
      setup: "Restart running games to apply",
      remove: "Restart running games to fully stop",
    });
    expect(Object.values(RESTART).join(" ")).not.toMatch(/device/i);
  });
});

describe("frameLimitTip", () => {
  it("computes the limit for 90 Hz", () => {
    expect(frameLimitTip(2)).toBe("Tip: set Steam's frame limit to 45 for 2x on your 90 Hz screen.");
    expect(frameLimitTip(3)).toContain("limit to 30 for 3x");
    expect(frameLimitTip(4)).toContain("limit to 22 for 4x");
  });
  it("uses another refresh rate when given", () => {
    expect(frameLimitTip(2, 60)).toContain("limit to 30 for 2x on your 60 Hz screen");
  });
});

describe("summaryLine", () => {
  it("names the preset and model", () => {
    expect(summaryLine({ multiplier: 2, preset: "balanced", performance_mode: false })).toBe(
      "2x · Balanced · Standard model"
    );
  });
  it("says Custom when no preset matches", () => {
    expect(summaryLine({ multiplier: 3, preset: null, performance_mode: true })).toBe(
      "3x · Custom · Performance model"
    );
  });
});

describe("restartBanner / PRESET_ORDER", () => {
  it("formats the banner", () => {
    expect(restartBanner("Elden Ring")).toBe("Restart Elden Ring to apply your changes.");
  });
  it("orders presets weakest to strongest", () => {
    expect(PRESET_ORDER).toEqual(["battery", "balanced", "quality"]);
  });
});

import { headerLine, multiplierToPosition, positionToMultiplier, SLIDER_LABELS } from "./logic";

describe("multiplier slider", () => {
  it("maps Off and 2x-4x to positions", () => {
    expect(SLIDER_LABELS).toEqual(["Off", "2x", "3x", "4x"]);
    expect(multiplierToPosition(false, 3)).toBe(0);
    expect(multiplierToPosition(true, 2)).toBe(1);
    expect(multiplierToPosition(true, 4)).toBe(3);
    expect(positionToMultiplier(0)).toBeNull();
    expect(positionToMultiplier(1)).toBe(2);
    expect(positionToMultiplier(3)).toBe(4);
  });
  it("clamps odd values", () => {
    expect(multiplierToPosition(true, 9)).toBe(3);
    expect(positionToMultiplier(7)).toBe(4);
    expect(positionToMultiplier(-1)).toBeNull();
  });
});

describe("headerLine", () => {
  it("describes running and off states", () => {
    expect(
      headerLine(true, { exists: true, multiplier: 2, preset: "balanced", performance_mode: false })
    ).toBe("Running | 2x · Balanced · Standard model");
    expect(
      headerLine(false, { exists: false, multiplier: 2, preset: "balanced", performance_mode: false })
    ).toBe("Not running | Off");
  });
});
