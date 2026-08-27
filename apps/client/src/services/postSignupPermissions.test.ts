import { beforeEach, describe, expect, it, vi } from "vitest";

const { isMobileNativeRuntimeMock } = vi.hoisted(() => ({
  isMobileNativeRuntimeMock: vi.fn(),
}));

vi.mock("@/services/platform", () => ({
  isMobileNativeRuntime: isMobileNativeRuntimeMock,
}));

import {
  arePostSignupPermissionsPending,
  completePostSignupPermissions,
  markPostSignupPermissionsPending,
} from "./postSignupPermissions";

describe("post-signup permission handoff", () => {
  beforeEach(() => {
    localStorage.clear();
    isMobileNativeRuntimeMock.mockReset();
    isMobileNativeRuntimeMock.mockReturnValue(true);
  });

  it("persists pending and completed state per user on native devices", () => {
    markPostSignupPermissionsPending("reader-one");

    expect(arePostSignupPermissionsPending("reader-one")).toBe(true);
    expect(arePostSignupPermissionsPending("reader-two")).toBe(false);

    completePostSignupPermissions("reader-one");
    expect(arePostSignupPermissionsPending("reader-one")).toBe(false);
  });

  it("does not introduce a permission step on web or PWA runtimes", () => {
    isMobileNativeRuntimeMock.mockReturnValue(false);
    markPostSignupPermissionsPending("reader-one");

    expect(arePostSignupPermissionsPending("reader-one")).toBe(false);
    expect(localStorage.length).toBe(0);
  });
});
