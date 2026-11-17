import { describe, expect, it } from "vitest";
import { clearCache, readCache, writeCache } from "./cache";

describe("panel cache", () => {
  it("merges writes and can be cleared", () => {
    clearCache();
    expect(readCache()).toEqual({});
    writeCache({ games: [{ app_id: 1, name: "A" }] });
    writeCache({ defaultPreset: "quality" });
    expect(readCache()).toEqual({ games: [{ app_id: 1, name: "A" }], defaultPreset: "quality" });
    clearCache();
    expect(readCache()).toEqual({});
  });
  it("keeps profiles per game and bounds how many are kept", () => {
    clearCache();
    for (let i = 0; i < 40; i++) writeCache({ profile: { appId: i, value: { n: i } } });
    const c = readCache();
    expect(Object.keys(c.profiles ?? {})).toHaveLength(20);
    expect(c.profiles?.[39]).toEqual({ n: 39 });
    expect(c.profiles?.[0]).toBeUndefined();
  });
});
