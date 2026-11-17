import { createContext, useContext } from "react";

export const InfoContext = createContext(false);

export function useInfo(text: string): string | undefined {
  return useContext(InfoContext) ? text : undefined;
}
