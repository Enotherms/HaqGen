import { Router } from "@decky/ui";
import { useEffect, useState } from "react";
import { subscribeAppLifetime } from "../steam";

export interface RunningGame {
  appId: number;
  name: string;
}

function readRunning(): RunningGame | null {
  try {
    const app = Router.MainRunningApp;
    return app ? { appId: Number(app.appid), name: app.display_name } : null;
  } catch {
    return null;
  }
}

export function useRunningGame(): RunningGame | null {
  const [game, setGame] = useState<RunningGame | null>(readRunning);

  useEffect(() => {
    const update = () => {
      const next = readRunning();
      setGame((prev) =>
        prev?.appId === next?.appId && prev?.name === next?.name ? prev : next
      );
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = subscribeAppLifetime(typeof SteamClient === "undefined" ? undefined : SteamClient, () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(update, 500);
    });
    update();
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      stop();
    };
  }, []);

  return game;
}
