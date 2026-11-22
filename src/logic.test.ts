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
  it("is short and points at the in-game cap", () => {
    expect(frameLimitTip(2)).toBe("Tip: cap the game at 45 FPS for 2x on 90 Hz.");
    expect(frameLimitTip(3)).toBe("Tip: cap the game at 30 FPS for 3x on 90 Hz.");
    expect(frameLimitTip(4, 60)).toBe("Tip: cap the game at 15 FPS for 4x on 60 Hz.");
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

import { multiplierToPosition, positionToMultiplier, SLIDER_LABELS } from "./logic";

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



import { scopeLine, scopeTitle } from "./logic";

describe("scope text", () => {
  it("titles the profile being edited", () => {
    expect(scopeTitle({ scope: "default", game: null, running: false })).toBe("Default profile");
    expect(scopeTitle({ scope: "game", game: "Elden Ring", running: false })).toBe("Elden Ring");
  });
  it("explains which profile applies", () => {
    expect(scopeLine({ scope: "default", game: null, running: false })).toBe("Used by games without their own profile");
    expect(scopeLine({ scope: "default", game: "Elden Ring", running: true })).toBe("Running · uses the Default profile");
    expect(scopeLine({ scope: "game", game: "Elden Ring", running: true })).toBe("Running · has its own profile");
    expect(scopeLine({ scope: "game", game: "Elden Ring", running: false })).toBe("Saved profile · applies when the game starts");
  });
});

import { editTarget } from "./logic";

describe("editTarget", () => {
  it("follows the running game", () => {
    expect(editTarget({ appId: 5, name: "Run" }, { app_id: 9, game: "Other" })).toEqual({ appId: 5, game: "Run", locked: true });
  });
  it("uses the picked profile when no game runs", () => {
    expect(editTarget(null, { app_id: 9, game: "Other" })).toEqual({ appId: 9, game: "Other", locked: false });
  });
  it("defaults to the Default profile", () => {
    expect(editTarget(null, null)).toEqual({ appId: null, game: null, locked: false });
    expect(editTarget(null, { app_id: null, game: null })).toEqual({ appId: null, game: null, locked: false });
  });
});

import { creatableGames } from "./logic";

describe("creatableGames", () => {
  const games = [
    { app_id: 1, name: "Alpha" },
    { app_id: 2, name: "Beta" },
    { app_id: 3, name: "Gamma" },
  ];
  it("lists installed games that do not have a profile yet", () => {
    const profiles = [
      { app_id: null, game: null, label: "Default" },
      { app_id: 2, game: "Beta", label: "Beta" },
    ];
    expect(creatableGames(games, profiles)).toEqual([
      { app_id: 1, name: "Alpha" },
      { app_id: 3, name: "Gamma" },
    ]);
  });
  it("returns nothing when every game has a profile", () => {
    const profiles = games.map((g) => ({ app_id: g.app_id, game: g.name, label: g.name }));
    expect(creatableGames(games, profiles)).toEqual([]);
  });
});


import { branchMessage, layersWarning } from "./logic";

describe("branchMessage", () => {
  it("describes each Lossless Scaling branch state", () => {
    expect(branchMessage({ installed: false, selected: null, current: null }, false)).toEqual({ ok: false, text: "Lossless Scaling not found. Install it from Steam." });
    expect(branchMessage({ installed: true, selected: "lsfg-vk", current: "lsfg-vk" }, true)).toEqual({ ok: true, text: "Lossless Scaling found (lsfg-vk branch)" });
    expect(branchMessage({ installed: true, selected: "lsfg-vk", current: "default" }, false).text).toBe(
      "Lossless Scaling is switching to the lsfg-vk branch. Let Steam finish downloading it."
    );
    expect(branchMessage({ installed: true, selected: "default", current: "default" }, false).text).toBe(
      "Switch Lossless Scaling to the lsfg-vk beta branch: Library › Lossless Scaling › Properties › Betas › lsfg-vk."
    );
  });
  it("trusts the DLL when Steam's record is missing", () => {
    expect(branchMessage({ installed: false, selected: null, current: null }, true).ok).toBe(true);
  });
});

describe("layersWarning", () => {
  it("names other Vulkan layers in one short line", () => {
    expect(layersWarning([])).toBeNull();
    expect(layersWarning(["VkLayer_MAKO_render"])).toBe("MAKO layer found. It may interfere.");
    expect(layersWarning(["VkLayer_MAKO_render", "vkBasalt"])).toBe("MAKO, vkBasalt layers found. They may interfere.");
  });
});

describe("debounce flush", () => {
  it("runs a pending call immediately with the latest value", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d(2);
    d(0);
    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(0);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it("does nothing when no call is pending", () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d.flush();
    expect(fn).not.toHaveBeenCalled();
  });
});

import { FPS_CAPS } from "./logic";

describe("FPS cap choices", () => {
  it("offers Off and common caps", () => {
    expect(FPS_CAPS).toEqual([0, 30, 40, 45, 60]);
  });
});

describe("Flatpak messages", () => {
  it("explains Flatpak errors in plain words", () => {
    expect(describeError("flatpak_install_failed")).toMatch(/Flathub/);
    expect(describeError("flatpak_runtime_unsupported")).toMatch(/not supported/);
    expect(describeError("flatpak_app_not_found")).toMatch(/not found/);
  });
});

import { engineMultiplier, showEngineChoice } from "./logic";

describe("engineMultiplier", () => {
  it("follows the slider's 2x to 4x", () => {
    expect(engineMultiplier(2)).toBe(2);
    expect(engineMultiplier(3)).toBe(3);
    expect(engineMultiplier(4)).toBe(4);
  });
  it("uses 2x when the multiplier is off, 1x or out of range", () => {
    expect(engineMultiplier(1)).toBe(2);
    expect(engineMultiplier(0)).toBe(2);
    expect(engineMultiplier(9)).toBe(4);
    expect(engineMultiplier(Number.NaN)).toBe(2);
  });
});

describe("showEngineChoice", () => {
  it("shows the choice when frame generation is on and HaqEngine is installed", () => {
    expect(showEngineChoice({ enabled: true, haqengine_installed: true, engine: "lsfg" })).toBe(true);
  });
  it("hides it when HaqEngine is not installed", () => {
    expect(showEngineChoice({ enabled: true, haqengine_installed: false, engine: "lsfg" })).toBe(false);
  });
  it("keeps it for a game already set to HaqEngine, so it can be switched back", () => {
    expect(showEngineChoice({ enabled: true, haqengine_installed: false, engine: "haqengine" })).toBe(true);
  });
  it("hides it when frame generation is off", () => {
    expect(showEngineChoice({ enabled: false, haqengine_installed: true, engine: "haqengine" })).toBe(false);
  });
});

import { haqengineAction } from "./logic";

describe("haqengineAction", () => {
  const base = { pinned: "0.1.0" };
  it("offers install when HaqEngine is missing", () => {
    expect(haqengineAction({ ...base, installed: false, update_available: false, version: null })).toEqual({
      label: "Install HaqEngine",
      line: "HaqEngine is not installed yet.",
    });
  });
  it("shows nothing extra when the pinned version is installed", () => {
    expect(haqengineAction({ ...base, installed: true, update_available: false, version: "0.1.0" })).toEqual({ label: null, line: null });
  });
  it("offers update from an older version", () => {
    expect(haqengineAction({ ...base, installed: true, update_available: true, version: "0.0.9" })).toEqual({
      label: "Update HaqEngine",
      line: "HaqEngine 0.0.9 → 0.1.0",
    });
  });
  it("offers update from a by-hand install of unknown version", () => {
    expect(haqengineAction({ ...base, installed: true, update_available: true, version: null })).toEqual({
      label: "Update HaqEngine",
      line: "HaqEngine unknown version → 0.1.0",
    });
  });
});

import { footerLine } from "./logic";

describe("footerLine", () => {
  it("names the version when known", () => {
    expect(footerLine("0.1.2")).toBe("HaqGen 0.1.2");
  });
  it("falls back to the name alone", () => {
    expect(footerLine(null)).toBe("HaqGen");
    expect(footerLine(undefined)).toBe("HaqGen");
  });
});
