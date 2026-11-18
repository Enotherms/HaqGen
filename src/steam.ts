interface Registration {
  unregister?: () => void;
}

interface SteamLike {
  GameSessions?: { RegisterForAppLifetimeNotifications?: (cb: () => void) => Registration | undefined };
}

export function subscribeAppLifetime(client: SteamLike | undefined, cb: () => void): () => void {
  try {
    const registration = client?.GameSessions?.RegisterForAppLifetimeNotifications?.(cb);
    return () => {
      try {
        registration?.unregister?.();
      } catch {
      }
    };
  } catch {
    return () => {};
  }
}
