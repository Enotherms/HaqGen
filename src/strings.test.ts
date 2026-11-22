import { describe, expect, it } from "vitest";
import { S } from "./strings";

describe("panel text", () => {
  it("keeps every note short (one line on the Deck)", () => {
    const notes = Object.entries(S).filter(([k, v]) => typeof v === "string" && /(Info|Note|Hint|How)$/.test(k));
    expect(notes.length).toBeGreaterThan(5);
    for (const [key, value] of notes) {
      expect({ key, length: (value as string).length }).toEqual({ key, length: expect.any(Number) });
      expect((value as string).length, key).toBeLessThanOrEqual(48);
    }
  });
  it("keeps restart tags to a few words", () => {
    for (const key of ["restartGame", "restartOnOff", "restartApp"] as const) {
      expect(S[key], key).toMatch(/restart/i);
      expect(S[key].length, key).toBeLessThanOrEqual(22);
    }
  });
  it("explains the advanced settings in plain words", () => {
    expect(S.perfModelInfo).toMatch(/GPU/);
    expect(S.gamescopeNote).toMatch(/Game Mode/);
    expect(S.engineInfo).not.toMatch(/restart/i);
    expect(S.fpsCapInfo).not.toMatch(/restart/i);
  });
  it("never mentions restarting the device", () => {
    expect(JSON.stringify(Object.values(S).filter((v) => typeof v === "string"))).not.toMatch(/restart (the )?(device|deck)/i);
  });
});
