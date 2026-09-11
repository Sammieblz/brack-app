interface LibraryBookPrimaryActionProps {
  title: string;
  selectMode?: boolean;
  selected?: boolean;
  opensDialog?: boolean;
  onActivate: () => void;
}

/** A sibling of the content and its controls, never an interactive ancestor. */
export function LibraryBookPrimaryAction({
  title, selectMode = false, selected = false, opensDialog = false, onActivate,
}: LibraryBookPrimaryActionProps) {
  return (
    <button
      type="button"
      className="library-book-primary"
      aria-label={`${selectMode ? "Select" : "Open"} ${title}`}
      aria-pressed={selectMode ? selected : undefined}
      aria-haspopup={!selectMode && opensDialog ? "dialog" : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (!event.defaultPrevented) {
          event.currentTarget.focus({ preventScroll: true });
          onActivate();
        }
      }}
    />
  );
}
