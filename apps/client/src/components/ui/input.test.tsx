import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useForm } from "react-hook-form";
import { Input } from "./input";
import { Label } from "./label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "./form";

afterEach(cleanup);

describe("Input accessible naming", () => {
  it("uses the visible native label even when a placeholder is present", () => {
    render(<><Label htmlFor="title">Review Title</Label><Input id="title" placeholder="Sum up your review in one line" /></>);
    expect(screen.getByRole("textbox", { name: "Review Title" })).not.toHaveAttribute("aria-label");
  });

  it("preserves explicit ARIA names and leaves placeholders as hints", () => {
    render(<><Input aria-label="Search clubs" placeholder="Search by genre" /><Input placeholder="Example input" /></>);
    expect(screen.getByRole("textbox", { name: "Search clubs" })).toHaveAttribute("aria-label", "Search clubs");
    expect(screen.getByPlaceholderText("Example input")).not.toHaveAttribute("aria-label");
  });

  it("preserves FormControl's visible label and validation associations", () => {
    const Example = () => {
      const form = useForm({ defaultValues: { title: "" } });
      return <Form {...form}>
        <FormField control={form.control} name="title" render={({ field }) => <FormItem>
          <FormLabel>Title</FormLabel>
          <FormControl><Input placeholder="Example title" {...field} /></FormControl>
          <FormDescription>Up to 200 characters</FormDescription>
          <FormMessage role="alert" />
        </FormItem>} />
        <button onClick={() => form.setError("title", { message: "Title is too long" })}>Show error</button>
      </Form>;
    };
    render(<Example />);
    const input = screen.getByRole("textbox", { name: "Title" });
    expect(input).toHaveAccessibleDescription("Up to 200 characters");
    fireEvent.click(screen.getByRole("button", { name: "Show error" }));
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Up to 200 characters Title is too long");
  });
});
