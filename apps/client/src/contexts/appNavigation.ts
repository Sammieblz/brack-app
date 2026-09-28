import { createContext } from "react";

export interface AppBackAction {
  fallbackPath?: string;
  to?: string;
  onBack?: () => void;
}

export interface AppNavigation {
  routeKey: string;
  canGoBack: boolean;
  requestBack: (action?: AppBackAction, source?: "ui" | "native") => void;
  registerGuard: (guard: () => boolean | Promise<boolean>, priority: number, routeKey: string) => () => void;
  registerControl: (element: HTMLButtonElement, action: () => AppBackAction, routeKey: string) => () => void;
}

export const AppNavigationContext = createContext<AppNavigation | null>(null);
