import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";

afterEach(cleanup);

function Controlled({ initial = "1999-02-05", required = false, minDate, maxDate }: {
  initial?: string; required?: boolean; minDate?: string; maxDate?: string;
}) {
  const [value, setValue] = useState<string | null>(initial);
  const [valid, setValid] = useState(true);
  return <>
    <DatePicker label="Reading date" locale="en-US" value={value} onChange={setValue}
      onValidityChange={setValid} required={required} minDate={minDate} maxDate={maxDate} />
    <output data-testid="value">{value ?? "empty"}</output>
    <button disabled={!valid}>Save</button>
  </>;
}

describe("DatePicker's editable date contract", () => {
  it("associates generated labels, format hints and validation errors without emitting invalid values", async () => {
    const onChange = vi.fn();
    const onValidityChange = vi.fn();
    render(<DatePicker label="Date of birth" locale="en-US" value="1999-02-05"
      onChange={onChange} onValidityChange={onValidityChange} />);
    const input = screen.getByRole("textbox", { name: "Date of birth" });
    expect(input).toHaveAccessibleDescription("Format: MM/DD/YYYY");
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
    fireEvent.change(input, { target: { value: "02/29/1900" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("02/29/1900");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Format: MM/DD/YYYY Enter a real calendar date.");
    expect(onValidityChange).toHaveBeenLastCalledWith(false);
    expect(onChange).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).checkValidity()).toBe(false);
  });

  it("keeps the typed representation and caret until blur, then formats the canonical date", () => {
    render(<Controlled />);
    const input = screen.getByRole("textbox", { name: "Reading date" });
    fireEvent.change(input, { target: { value: "2000-02-29" } });
    expect(input).toHaveValue("2000-02-29");
    expect(screen.getByTestId("value")).toHaveTextContent("2000-02-29");
    fireEvent.blur(input);
    expect(input).toHaveValue("02/29/2000");
    fireEvent.change(input, { target: { value: "02/" } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByTestId("value")).toHaveTextContent("2000-02-29");
  });

  it("clears optional dates to null but keeps required drafts invalid without erasing a committed value", () => {
    const { unmount } = render(<Controlled />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    expect(screen.getByTestId("value")).toHaveTextContent("empty");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    unmount();
    render(<Controlled required />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    fireEvent.blur(screen.getByRole("textbox"));
    expect(screen.getByTestId("value")).toHaveTextContent("1999-02-05");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a date");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("revalidates changed paired bounds without modifying the selected date", () => {
    const onChange = vi.fn();
    const onValidityChange = vi.fn();
    const { rerender } = render(<DatePicker label="Finish" locale="en-US" value="1999-02-05"
      onChange={onChange} onValidityChange={onValidityChange} minDate="1999-02-05" />);
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
    rerender(<DatePicker label="Finish" locale="en-US" value="1999-02-05"
      onChange={onChange} onValidityChange={onValidityChange} minDate="1999-02-06" />);
    expect(onValidityChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("alert")).toHaveTextContent("on or after 02/06/1999");
    expect(screen.getByRole("textbox")).toHaveValue("02/05/1999");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("updates externally supplied values and locale without shifting legacy timestamp dates", () => {
    const onChange = vi.fn();
    const { rerender } = render(<DatePicker label="Date" locale="en-US" value="1999-02-05T00:00:00Z" onChange={onChange} />);
    expect(screen.getByRole("textbox")).toHaveValue("02/05/1999");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "broken" } });
    rerender(<DatePicker label="Date" locale="fr-FR" value="2000-02-29" onChange={onChange} />);
    expect(screen.getByRole("textbox")).toHaveValue("29/02/2000");
    expect(screen.getByRole("button", { name: "Choisir une date: Date" })).toBeEnabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("preserves selected values while browsing and commits when reselecting the same day", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const trigger = screen.getByRole("button", { name: "Choose date: Reading date" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("grid")).toHaveAccessibleName("February 1999");
    await user.click(within(dialog).getByRole("button", { name: "Choose year" }));
    await user.click(within(dialog).getByRole("button", { name: "Next decade" }));
    expect(screen.getByTestId("value")).toHaveTextContent("1999-02-05");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    await user.click(screen.getByRole("gridcell", { name: "Friday, February 5, 1999" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("value")).toHaveTextContent("1999-02-05");
  });

  it("cannot silently save a previous value after emptying a non-clearable field", () => {
    const onChange = vi.fn();
    const onValidityChange = vi.fn();
    render(<DatePicker label="Date" locale="en-US" value="1999-02-05" allowClear={false}
      onChange={onChange} onValidityChange={onValidityChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    fireEvent.blur(screen.getByRole("textbox"));
    expect(onChange).not.toHaveBeenCalled();
    expect(onValidityChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a date");
  });
});
