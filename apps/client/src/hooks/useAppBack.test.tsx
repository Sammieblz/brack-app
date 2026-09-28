import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
import { useAppBack } from "./useAppBack";

beforeEach(() => { navigate.mockClear(); });
afterEach(() => { window.history.replaceState(null, ""); });

describe("app back ownership", () => {
  it("keeps an explicit callback ahead of route and browser history choices", () => {
    window.history.replaceState({ idx: 2 }, "");
    const onBack = vi.fn();
    const { result } = renderHook(() => useAppBack({ onBack, to: "/profile", fallbackPath: "/my-books" }));
    act(() => result.current.goBack());
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("honors an explicit destination even when app history is available", () => {
    window.history.replaceState({ idx: 2 }, "");
    const { result } = renderHook(() => useAppBack({ to: "/profile", fallbackPath: "/my-books" }));
    act(() => result.current.goBack());
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/profile");
  });

  it("checks the current browser index at activation instead of retaining an earlier value", () => {
    window.history.replaceState({ idx: 2 }, "");
    const { result } = renderHook(() => useAppBack({ fallbackPath: "/my-books" }));
    window.history.replaceState({ idx: 0, key: "replaced-entry" }, "");
    act(() => result.current.goBack());
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/my-books");
  });
});
