import type { UIEnvironment } from "@/services/uiEnvironment";

export const getShellNavigation = (
  environment: Pick<UIEnvironment, "runtime" | "displayMode" | "windowClass">,
): "tabs" | "menu" | "sidebar" => {
  if (environment.windowClass === "expanded") return "sidebar";
  return environment.runtime === "ios" || environment.runtime === "android" ||
    (environment.runtime === "web" && environment.displayMode === "standalone")
    ? "tabs" : "menu";
};

/** Focus policy, not software-keyboard detection. Hardware keyboards also
 * benefit from keeping the active editing task clear of global controls. */
export const isShellEditingTarget = (target: Element | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return !target.readOnly && !target.disabled;
  return target instanceof HTMLInputElement && !target.readOnly && !target.disabled &&
    !["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "hidden"].includes(target.type);
};
