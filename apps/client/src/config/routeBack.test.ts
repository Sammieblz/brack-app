import { describe, expect, it } from "vitest";
import { getRouteBackPolicy } from "./routeBack";

describe("Back route presentation metadata", () => {
  it("matches Router's case-insensitive auth boundaries and trailing slashes", () => {
    expect(getRouteBackPolicy("/AUTH/Callback/", true)).toEqual({ kind: "boundary", fallbackPath: "/dashboard" });
    expect(getRouteBackPolicy("/auth/reset-password", false)).toEqual({ kind: "boundary", fallbackPath: "/" });
    expect(getRouteBackPolicy("/app-permissions/", true).kind).toBe("boundary");
  });

  it("keeps encoded book identity intact in edit and progress parents", () => {
    expect(getRouteBackPolicy("/EDIT-BOOK/Book%2FPart%20A", true)).toEqual({ kind: "task", fallbackPath: "/book/Book%2FPart%20A" });
    expect(getRouteBackPolicy("/BOOK/Book%2FPart%20A/PROGRESS/", true)).toEqual({ kind: "task", fallbackPath: "/book/Book%2FPart%20A" });
    expect(getRouteBackPolicy("/scan", true)).toEqual(getRouteBackPolicy("/scan-barcode", true));
    expect(getRouteBackPolicy("/scan-cover", true)).toEqual({ kind: "task", fallbackPath: "/add-book" });
  });

  it("keeps existing route aliases equivalent and uses signed-in recovery for unknown routes", () => {
    expect(getRouteBackPolicy("/books/", true)).toEqual(getRouteBackPolicy("/my-books", true));
    expect(getRouteBackPolicy("/book-lists", true)).toEqual(getRouteBackPolicy("/lists", true));
    expect(getRouteBackPolicy("/lists/My%20List", true)).toEqual({ kind: "detail", fallbackPath: "/lists" });
    expect(getRouteBackPolicy("/users/reader", false)).toEqual({ kind: "detail", fallbackPath: "/readers" });
    expect(getRouteBackPolicy("/unknown/route", false).fallbackPath).toBe("/");
    expect(getRouteBackPolicy("/unknown/route", true).fallbackPath).toBe("/dashboard");
  });
});
