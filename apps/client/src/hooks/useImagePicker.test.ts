import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useImagePicker } from "./useImagePicker";

const mocks = vi.hoisted(() => ({ native: false, getPhoto: vi.fn(), toast: vi.fn() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => mocks.native } }));
vi.mock("@capacitor/camera", () => ({ Camera: { getPhoto: mocks.getPhoto }, CameraResultType: { DataUrl: "dataUrl" }, CameraSource: { Photos: "photos", Camera: "camera", Prompt: "prompt" } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); mocks.native = false; });
describe("web image source pending lifetime", () => {
  it("stays pending until the browser chooser returns or cancels", async () => {
    const choosers: HTMLInputElement[] = [];
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) { choosers.push(this); });
    const { result } = renderHook(() => useImagePicker());
    let selection!: ReturnType<typeof result.current.pickFromPhotos>;
    act(() => { selection = result.current.pickFromPhotos(); });
    expect(result.current.picking).toBe(true);
    await act(async () => {
      choosers[0].dispatchEvent(new Event("cancel"));
      expect(await selection).toBeNull();
    });
    expect(result.current.picking).toBe(false);
  });
  it("ignores a device failure after its owning editor unmounts", async () => {
    mocks.native = true;
    let fail!: (error: Error) => void;
    mocks.getPhoto.mockReturnValueOnce(new Promise((_, reject) => { fail = reject; }));
    const { result, unmount } = renderHook(() => useImagePicker());
    let selection!: ReturnType<typeof result.current.pickFromPhotos>;
    act(() => { selection = result.current.pickFromPhotos(); });
    unmount();
    await act(async () => {
      fail(new Error("Permission denied"));
      expect(await selection).toBeNull();
    });
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
