import { describe, expect, it, vi } from "vitest";
import { subscribeAppLifetime } from "./steam";

describe("subscribeAppLifetime", () => {
  it("registers and unregisters with Steam", () => {
    const unregister = vi.fn();
    const client = { GameSessions: { RegisterForAppLifetimeNotifications: vi.fn(() => ({ unregister })) } };
    const cb = vi.fn();
    const stop = subscribeAppLifetime(client, cb);
    expect(client.GameSessions.RegisterForAppLifetimeNotifications).toHaveBeenCalledWith(cb);
    stop();
    expect(unregister).toHaveBeenCalled();
  });
  it("does nothing (and never throws) when Steam's API is missing or changed", () => {
    for (const client of [undefined, {}, { GameSessions: {} }, { GameSessions: { RegisterForAppLifetimeNotifications: () => { throw new Error("changed"); } } }, { GameSessions: { RegisterForAppLifetimeNotifications: () => undefined } }]) {
      const stop = subscribeAppLifetime(client as never, () => {});
      expect(() => stop()).not.toThrow();
    }
  });
});
