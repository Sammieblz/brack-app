import { describe, expect, it } from "vitest";
import { getShellNavigation, isShellEditingTarget } from "./shellPresentation";

describe("shell presentation keeps runtime distinct from window space", () => {
  it.each([
    ["web", "browser", "compact", "menu"],
    ["web", "browser", "medium", "menu"],
    ["web", "standalone", "compact", "tabs"],
    ["web", "standalone", "medium", "tabs"],
    ["ios", "app", "compact", "tabs"],
    ["ios", "app", "medium", "tabs"],
    ["android", "app", "medium", "tabs"],
    ["desktop", "app", "compact", "menu"],
    ["desktop", "app", "medium", "menu"],
    ["ios", "app", "expanded", "sidebar"],
    ["web", "standalone", "expanded", "sidebar"],
    ["web", "browser", "expanded", "sidebar"],
  ] as const)("%s / %s / %s uses %s", (runtime, displayMode, windowClass, result) => {
    expect(getShellNavigation({ runtime, displayMode, windowClass })).toBe(result);
  });

  it("prioritizes actual text editing without hiding navigation for buttons or read-only fields", () => {
    for (const type of ["text", "search", "email", "number", "date", "password"]) {
      const input = document.createElement("input");
      input.type = type;
      expect(isShellEditingTarget(input)).toBe(true);
      input.readOnly = true;
      expect(isShellEditingTarget(input)).toBe(false);
    }
    for (const type of ["button", "checkbox", "range", "radio", "file"]) {
      const input = document.createElement("input");
      input.type = type;
      expect(isShellEditingTarget(input)).toBe(false);
    }
    expect(isShellEditingTarget(document.createElement("textarea"))).toBe(true);
    expect(isShellEditingTarget(document.createElement("button"))).toBe(false);
    expect(isShellEditingTarget(null)).toBe(false);
  });
});
