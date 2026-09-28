import { StrictMode, createRef, useState, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "./alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "./drawer";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "./dropdown-menu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "./context-menu";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from "./menubar";
import { ImageLightbox } from "./image-lightbox";
import { hasOpenOverlay, requestOverlayBack } from "@/lib/backLayers";
import { useBackLayer } from "@/hooks/useBackLayer";

vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));

beforeAll(() => {
  // jsdom has no layout/scroll or pointer capture; production primitives remain real.
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  expect(hasOpenOverlay()).toBe(false);
});

function Outer({ children, guard, preventEscape = false }: {
  children?: ReactNode; guard?: () => void; preventEscape?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={(next) => {
    if (!next && guard) { guard(); return; }
    setOpen(next);
  }}>
    <DialogTrigger>Open editor</DialogTrigger>
    <DialogContent onEscapeKeyDown={preventEscape ? (event) => event.preventDefault() : undefined}>
      <DialogTitle>Book editor</DialogTitle><DialogDescription>Keep this draft.</DialogDescription>
      <input aria-label="Draft" defaultValue="Retained writing" />
      {children}
    </DialogContent>
  </Dialog>;
}

function appBack() {
  let consumed = false;
  act(() => { consumed = requestOverlayBack(); });
  expect(consumed).toBe(true);
}

describe("Back delegates to the existing primitive dismissal owner", () => {
  it("closes an uncontrolled dialog, restores trigger focus, then releases ownership", async () => {
    render(<Dialog><DialogTrigger>Open</DialogTrigger><DialogContent>
      <DialogTitle>Details</DialogTitle><DialogDescription>A book.</DialogDescription>
    </DialogContent></Dialog>);
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);
    appBack();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(requestOverlayBack()).toBe(false);
  });

  it("consumes a pending/dirty controlled dismissal without clearing content", () => {
    const guard = vi.fn();
    render(<Outer guard={guard} />);
    fireEvent.click(screen.getByText("Open editor"));
    appBack();
    expect(guard).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Retained writing");
    expect(hasOpenOverlay()).toBe(true);
  });

  it("preserves onEscapeKeyDown.preventDefault and never calls the close guard", () => {
    const guard = vi.fn();
    render(<Outer guard={guard} preventEscape />);
    fireEvent.click(screen.getByText("Open editor"));
    appBack();
    expect(guard).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("dismisses the nested popover before its containing editor and retains writing", async () => {
    render(<Outer><Popover><PopoverTrigger>Pick date</PopoverTrigger>
      <PopoverContent><button>Calendar day</button></PopoverContent>
    </Popover></Outer>);
    fireEvent.click(screen.getByText("Open editor"));
    const trigger = screen.getByText("Pick date");
    fireEvent.click(trigger);
    expect(screen.getByText("Calendar day")).toBeInTheDocument();
    appBack();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByText("Calendar day")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Retained writing");
    appBack();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes a nested Select without selecting an option or dismissing its editor", async () => {
    const onValueChange = vi.fn();
    render(<Outer><Select defaultValue="note" onValueChange={onValueChange}>
      <SelectTrigger aria-label="Entry type"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="note">Note</SelectItem><SelectItem value="quote">Quote</SelectItem></SelectContent>
    </Select></Outer>);
    fireEvent.click(screen.getByText("Open editor"));
    const trigger = screen.getByRole("combobox", { name: "Entry type" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    appBack();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Retained writing");
  });

  it("uses Radix's nested menu Escape behavior without executing actions or closing the editor", async () => {
    const action = vi.fn();
    render(<Outer><DropdownMenu><DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent><DropdownMenuSub>
        <DropdownMenuSubTrigger>More actions</DropdownMenuSubTrigger>
        <DropdownMenuSubContent><DropdownMenuItem onSelect={action}>Remove book</DropdownMenuItem></DropdownMenuSubContent>
      </DropdownMenuSub></DropdownMenuContent>
    </DropdownMenu></Outer>);
    fireEvent.click(screen.getByText("Open editor"));
    fireEvent.keyDown(screen.getByText("Actions"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByText("More actions"), { key: "ArrowRight" });
    expect(await screen.findByRole("menuitem", { name: "Remove book" })).toBeInTheDocument();
    appBack();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Retained writing");
  });

  it.each(["alert", "sheet", "drawer"] as const)("requests dismissal from a real %s primitive", (kind) => {
    const dismiss = vi.fn();
    if (kind === "alert") render(<AlertDialog open onOpenChange={dismiss}><AlertDialogContent>
      <AlertDialogTitle>Delete book?</AlertDialogTitle><AlertDialogDescription>Confirm explicitly.</AlertDialogDescription>
    </AlertDialogContent></AlertDialog>);
    if (kind === "sheet") render(<Sheet open onOpenChange={dismiss}><SheetContent>
      <SheetTitle>Profile</SheetTitle><SheetDescription>Reader details.</SheetDescription>
    </SheetContent></Sheet>);
    if (kind === "drawer") render(<Drawer open onOpenChange={dismiss}><DrawerContent>
      <DrawerTitle>Confirm removal</DrawerTitle><DrawerDescription>Choose an action.</DrawerDescription>
    </DrawerContent></Drawer>);
    appBack();
    expect(dismiss).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("honors a non-dismissible Vaul drawer", () => {
    const dismiss = vi.fn();
    render(<Drawer open dismissible={false} onOpenChange={dismiss}><DrawerContent>
      <DrawerTitle>Saving</DrawerTitle><DrawerDescription>Wait for the local write.</DrawerDescription>
    </DrawerContent></Drawer>);
    appBack();
    expect(dismiss).not.toHaveBeenCalled();
    expect(hasOpenOverlay()).toBe(true);
  });

  it("owns a context menu without a controlled Root API", () => {
    render(<ContextMenu><ContextMenuTrigger>Book cover</ContextMenuTrigger>
      <ContextMenuContent><ContextMenuItem>View book</ContextMenuItem></ContextMenuContent>
    </ContextMenu>);
    fireEvent.contextMenu(screen.getByText("Book cover"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    appBack();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("owns a menubar menu without a dialog provider", () => {
    render(<Menubar><MenubarMenu><MenubarTrigger>Book</MenubarTrigger><MenubarContent>
      <MenubarItem>View book</MenubarItem>
    </MenubarContent></MenubarMenu></Menubar>);
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Book" }), { key: "ArrowDown" });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    appBack();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("does not invoke ImageLightbox's close callback twice for app Back or Escape", () => {
    const close = vi.fn();
    render(<ImageLightbox src="/book.svg" alt="Book cover" isOpen onClose={close} />);
    appBack();
    expect(close).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("composes object and callback refs and unregisters across StrictMode remounts", () => {
    const objectRef = createRef<HTMLDivElement>();
    const callback = vi.fn();
    function Content({ callbackRef = false }: { callbackRef?: boolean }) {
      const ref = useBackLayer(callbackRef ? callback : objectRef);
      return <div ref={ref} data-state="open">Explicit content</div>;
    }
    const mounted = render(<StrictMode><Content /></StrictMode>);
    expect(objectRef.current).toBe(screen.getByText("Explicit content"));
    expect(hasOpenOverlay()).toBe(true);
    mounted.rerender(<StrictMode><Content callbackRef /></StrictMode>);
    expect(objectRef.current).toBe(null);
    expect(callback).toHaveBeenLastCalledWith(screen.getByText("Explicit content"));
    mounted.unmount();
    expect(callback).toHaveBeenLastCalledWith(null);
    expect(requestOverlayBack()).toBe(false);
  });
});
