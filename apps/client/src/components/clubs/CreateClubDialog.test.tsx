import { useRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestOverlayBack } from "@/lib/backLayers";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  auth: { user: { id: "reader" } as { id: string } | null, loading: false },
}));
vi.mock("@/services/api/clubs", () => ({ uploadClubImageFile: mocks.upload }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));

import { CreateClubDialog, CreateClubDialogTrigger } from "./CreateClubDialog";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function Controlled({ create, changed = () => undefined, wide = false }: {
  create: () => Promise<unknown>;
  changed?: (open: boolean) => void;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const trigger = <CreateClubDialogTrigger ref={ref} compact={!wide} onClick={() => setOpen(true)} />;
  return <>
    {wide ? <header>{trigger}</header> : <nav>{trigger}</nav>}
    <CreateClubDialog open={open} onOpenChange={(next) => { changed(next); setOpen(next); }} trigger={null} returnFocusRef={ref} onCreateClub={create} />
  </>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth = { user: { id: "reader" }, loading: false };
  mocks.upload.mockImplementation(async (_file: File, kind: string) => `reader/${kind}.webp`);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:club-preview"), revokeObjectURL: vi.fn() }));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function openClub() {
  fireEvent.click(screen.getByRole("button", { name: "Create club" }));
  return screen.findByRole("dialog", { name: "Create Book Club" });
}
const nameInput = () => screen.getByRole("textbox", { name: "Club Name *" });
const submit = () => fireEvent.submit(nameInput().closest("form")!);

describe("club creation task ownership", () => {
  it("keeps the same fields, selection, files and privacy when its controlled trigger is replaced", async () => {
    const create = vi.fn();
    const view = render(<Controlled create={create} />);
    const dialog = await openClub();
    const name = nameInput() as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Shared reading" } });
    const banner = new File(["banner"], "banner.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Banner image", { exact: true }), { target: { files: [banner] } });
    fireEvent.change(screen.getByRole("textbox", { name: "City" }), { target: { value: "Accra" } });
    fireEvent.click(screen.getByRole("switch", { name: "Private Club" }));
    name.focus(); name.setSelectionRange(2, 7);
    view.rerender(<Controlled create={create} wide />);
    expect(screen.getByRole("dialog", { name: "Create Book Club" })).toBe(dialog);
    expect(nameInput()).toBe(name);
    expect(name).toHaveFocus();
    expect([name.selectionStart, name.selectionEnd]).toEqual([2, 7]);
    expect(screen.getByLabelText("Banner image", { exact: true })).toHaveAccessibleDescription("banner.png");
    expect(screen.getByRole("textbox", { name: "City" })).toHaveValue("Accra");
    expect(screen.getByRole("switch", { name: "Private Club" })).toHaveAttribute("aria-checked", "true");
  });

  it("protects dirty Close/Cancel/Escape/app Back, keeps work and explicitly discards to the replacement trigger", async () => {
    const create = vi.fn();
    const view = render(<Controlled create={create} />);
    const dialog = await openClub();
    fireEvent.change(nameInput(), { target: { value: "Keep our club" } });
    for (const dismiss of [
      () => fireEvent.click(within(dialog).getByRole("button", { name: "Close" })),
      () => fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" })),
      () => fireEvent.keyDown(document, { key: "Escape" }),
      () => expect(requestOverlayBack()).toBe(true),
    ]) {
      act(dismiss);
      const confirmation = await screen.findByRole("dialog", { name: "Discard this club draft?" });
      const keep = within(confirmation).getByRole("button", { name: "Keep editing" });
      await waitFor(() => expect(keep).toHaveFocus());
      fireEvent.click(keep);
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Discard this club draft?" })).not.toBeInTheDocument());
      expect(nameInput()).toHaveValue("Keep our club");
    }
    view.rerender(<Controlled create={create} wide />);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard draft" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Create club" })).toHaveFocus());
    await openClub();
    expect(nameInput()).toHaveValue("");
    expect(create).not.toHaveBeenCalled();
  });

  it("serializes synchronous submissions and refuses pending dismissal until confirmed success closes once", async () => {
    const creation = deferred<unknown>();
    const create = vi.fn(() => creation.promise);
    const changed = vi.fn();
    render(<Controlled create={create} changed={changed} />);
    const dialog = await openClub();
    fireEvent.change(nameInput(), { target: { value: "Committed club" } });
    act(() => { submit(); submit(); });
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(nameInput()).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => expect(requestOverlayBack()).toBe(true));
    expect(dialog).toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Discard this club draft?" })).not.toBeInTheDocument();
    await act(async () => creation.resolve({ id: "created" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(changed.mock.calls).toEqual([[false]]);
    await openClub();
    expect(nameInput()).toHaveValue("");
  });

  it("retains failed creation fields and files, then reuses confirmed uploads on retry", async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error("Creation unavailable")).mockResolvedValueOnce({ id: "club" });
    render(<CreateClubDialog onCreateClub={create} />);
    await openClub();
    fireEvent.change(nameInput(), { target: { value: "  Mystery readers  " } });
    fireEvent.change(screen.getByRole("textbox", { name: "Genres" }), { target: { value: "Mystery, Fiction" } });
    fireEvent.change(screen.getByLabelText("Banner image", { exact: true }), {
      target: { files: [new File(["banner"], "banner.png", { type: "image/png" })] },
    });
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Creation unavailable");
    expect(nameInput()).toHaveValue("  Mystery readers  ");
    expect(nameInput()).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Banner image", { exact: true })).toHaveAccessibleDescription("banner.png");
    expect(screen.getByRole("button", { name: "Create Club" })).toHaveAccessibleDescription("Creation unavailable");
    submit();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0]).toEqual(expect.objectContaining({ name: "Mystery readers", genres: ["Mystery", "Fiction"], banner_image_path: "reader/banner.webp" }));
  });

  it("waits for both image outcomes, retains a partial successful upload and retries only the failed file", async () => {
    const banner = deferred<string>();
    mocks.upload.mockImplementationOnce(() => banner.promise).mockRejectedValueOnce(new Error("Profile upload unavailable")).mockResolvedValueOnce("reader/avatar.webp");
    const create = vi.fn().mockResolvedValue({ id: "club" });
    render(<CreateClubDialog onCreateClub={create} />);
    await openClub();
    fireEvent.change(nameInput(), { target: { value: "Our club" } });
    for (const label of ["Banner image", "Profile image"]) {
      fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { files: [new File([label], `${label}.png`, { type: "image/png" })] } });
    }
    submit();
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(2));
    expect(nameInput()).toBeDisabled();
    expect(create).not.toHaveBeenCalled();
    await act(async () => banner.resolve("reader/banner.webp"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Profile upload unavailable");
    expect(nameInput()).toBeEnabled();
    submit();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(mocks.upload).toHaveBeenCalledTimes(3);
    expect(mocks.upload.mock.calls[2][1]).toBe("avatar");
  });

  for (const abandonment of ["unmount", "account", "auth loading"] as const) {
    it(`does not create after an upload completes following ${abandonment}`, async () => {
      const upload = deferred<string>();
      mocks.upload.mockReturnValue(upload.promise);
      const create = vi.fn();
      const view = render(<Controlled create={create} />);
      await openClub();
      fireEvent.change(nameInput(), { target: { value: "Previous reader club" } });
      fireEvent.change(screen.getByLabelText("Banner image", { exact: true }), { target: { files: [new File(["banner"], "banner.png", { type: "image/png" })] } });
      submit();
      await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
      if (abandonment === "unmount") view.unmount();
      else {
        mocks.auth = { user: { id: abandonment === "account" ? "other-reader" : "reader" }, loading: abandonment === "auth loading" };
        view.rerender(<Controlled create={create} />);
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      }
      await act(async () => upload.resolve("old-reader/banner.webp"));
      expect(create).not.toHaveBeenCalled();
      if (abandonment === "account") {
        await openClub();
        expect(nameInput()).toHaveValue("");
        expect(screen.getByLabelText("Banner image", { exact: true })).not.toHaveAccessibleDescription("banner.png");
      }
    });
  }

  it("ignores a previous account's late failure while the next account edits", async () => {
    const creation = deferred<unknown>();
    const create = vi.fn(() => creation.promise);
    const view = render(<Controlled create={create} />);
    await openClub();
    fireEvent.change(nameInput(), { target: { value: "Previous reader" } });
    submit();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    mocks.auth = { user: { id: "next-reader" }, loading: false };
    view.rerender(<Controlled create={create} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await openClub();
    fireEvent.change(nameInput(), { target: { value: "Next reader" } });
    await act(async () => creation.reject(new Error("Old failure")));
    expect(nameInput()).toHaveValue("Next reader");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
