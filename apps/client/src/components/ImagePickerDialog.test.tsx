import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImagePickerDialog } from "./ImagePickerDialog";

const { pick } = vi.hoisted(() => ({ pick: vi.fn() }));
vi.mock("@/hooks/useImagePicker", () => ({ useImagePicker: () => ({ pickFromCamera: pick, pickFromPhotos: pick, picking: false }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("shared image source task", () => {
  it("serializes selection and refuses Escape while the source is unresolved", async () => {
    let finish!: (image: { dataUrl: string; format: string }) => void;
    pick.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const onImagePicked = vi.fn(); const onOpenChange = vi.fn();
    render(<ImagePickerDialog open onImagePicked={onImagePicked} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    fireEvent.click(screen.getByRole("button", { name: "Photo Library" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(pick).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
    await act(async () => finish({ dataUrl: "data:image/png;base64,YQ==", format: "png" }));
    expect(onImagePicked).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("ignores a selection that outlives its opening", async () => {
    let finish!: (image: { dataUrl: string; format: string }) => void;
    pick.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const onImagePicked = vi.fn(); const onOpenChange = vi.fn();
    const view = render(<ImagePickerDialog open onImagePicked={onImagePicked} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Photo Library" }));
    view.rerender(<ImagePickerDialog open={false} onImagePicked={onImagePicked} onOpenChange={onOpenChange} />);
    await act(async () => finish({ dataUrl: "data:image/png;base64,YQ==", format: "png" }));
    expect(onImagePicked).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("keeps the dialog open after source cancellation and unlocks another selection", async () => {
    const image = { dataUrl: "data:image/png;base64,YQ==", format: "png" };
    pick.mockResolvedValueOnce(null).mockResolvedValueOnce(image);
    const onImagePicked = vi.fn(); const onOpenChange = vi.fn();
    render(<ImagePickerDialog open onImagePicked={onImagePicked} onOpenChange={onOpenChange} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Camera" })));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onImagePicked).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Photo Library" })));
    expect(pick).toHaveBeenCalledTimes(2);
    expect(onImagePicked).toHaveBeenCalledExactlyOnceWith(image);
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });
  it("does not let an old selection unlock or overwrite a newer opening's selection", async () => {
    let finishOld!: (image: { dataUrl: string; format: string }) => void;
    let finishNew!: (image: { dataUrl: string; format: string }) => void;
    pick.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }))
      .mockReturnValueOnce(new Promise(resolve => { finishNew = resolve; }));
    const onImagePicked = vi.fn(); const onOpenChange = vi.fn();
    const view = render(<ImagePickerDialog open onImagePicked={onImagePicked} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    view.rerender(<ImagePickerDialog open={false} onImagePicked={onImagePicked} onOpenChange={onOpenChange} />);
    view.rerender(<ImagePickerDialog open onImagePicked={onImagePicked} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Photo Library" }));
    await act(async () => finishOld({ dataUrl: "data:image/png;base64,b2xk", format: "png" }));
    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(pick).toHaveBeenCalledTimes(2);
    expect(onImagePicked).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    const newImage = { dataUrl: "data:image/png;base64,bmV3", format: "png" };
    await act(async () => finishNew(newImage));
    expect(onImagePicked).toHaveBeenCalledExactlyOnceWith(newImage);
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });
});
