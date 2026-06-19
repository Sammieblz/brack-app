import { describe, expect, it } from "vitest";
import {
  canonicalizeIsbn,
  extractIsbnFromScan,
  isValidIsbn10,
  isValidIsbn13,
  isbn10To13,
} from "./isbn";

describe("ISBN validation", () => {
  it("validates known ISBN-10 and ISBN-13 values", () => {
    expect(isValidIsbn10("0306406152")).toBe(true);
    expect(isValidIsbn13("9780306406157")).toBe(true);
    expect(isValidIsbn13("9780306406158")).toBe(false);
  });

  it("canonicalizes ISBN-10 to ISBN-13", () => {
    expect(isbn10To13("0306406152")).toBe("9780306406157");
    expect(canonicalizeIsbn("0-306-40615-2")).toBe("9780306406157");
  });

  it("extracts ISBN from supported QR URLs and rejects unrelated QR values", () => {
    expect(extractIsbnFromScan("https://openlibrary.org/isbn/9780306406157")).toBe(
      "9780306406157"
    );
    expect(extractIsbnFromScan("https://example.com/not-a-book")).toBeNull();
  });
});
