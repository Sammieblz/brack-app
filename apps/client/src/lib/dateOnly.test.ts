import { describe, expect, it } from "vitest";
import { getDateInputFormat, normalizeDateOnly, todayDateOnly, toLocalDate, validateDateOnly } from "./dateOnly";

describe("normalizeDateOnly", () => {
  it.each(["0001-01-01", "0099-12-31", "1900-02-28", "1999-02-05", "2000-02-29", "2024-02-29", "9999-12-31"])("preserves valid Gregorian date %s", (date) => {
    expect(normalizeDateOnly(date)).toBe(date);
  });

  it.each(["0000-01-01", "1900-02-29", "1999-02-29", "2100-02-29", "2024-04-31", "2024-00-01", "2024-13-01", "2024-01-00", "2024-01-32", "2024-2-9", "24-02-09", "2024-02", "02/05/1999", "1999-02-05 junk", "1999-02-05T25:00:00Z", "1999-02-05T12:60:00Z", "", " ", null, undefined, new Date(NaN)])("rejects invalid or noncanonical value %s without rollover", (value) => {
    expect(normalizeDateOnly(value)).toBeNull();
  });

  it.each([
    "1999-02-05T00:00:00Z",
    "1999-02-05T00:00:00+14:00",
    "1999-02-05T23:30:00-12:00",
    "1999-02-05T12:34:56.123456+00:00",
    "1999-02-05T12:34:00",
  ])("retains the recorded date of legacy timestamp %s", (value) => {
    expect(normalizeDateOnly(value)).toBe("1999-02-05");
  });

  it("rejects a timestamp whose calendar date would roll over", () => {
    expect(normalizeDateOnly("1900-02-29T00:00:00Z")).toBeNull();
    expect(normalizeDateOnly("2024-04-31T00:00:00Z")).toBeNull();
  });

  it("uses a Date object's local components, not toISOString", () => {
    const date = new Date(1999, 1, 5, 0, 15);
    expect(normalizeDateOnly(date)).toBe("1999-02-05");
    expect(todayDateOnly(date)).toBe("1999-02-05");
  });
});

describe("toLocalDate", () => {
  it.each(["0001-01-01", "0099-12-31", "1900-02-28", "1999-02-05", "2000-02-29", "2024-03-10", "2024-11-03"])("round-trips %s through local noon, including DST boundary dates", (value) => {
    const date = toLocalDate(value);
    expect(date).toBeInstanceOf(Date);
    expect(normalizeDateOnly(date)).toBe(value);
    expect(date?.getHours()).toBe(12);
    expect(date?.getMinutes()).toBe(0);
  });

  it("does not mutate a supplied Date", () => {
    const original = new Date(1999, 1, 5, 22, 12);
    const timestamp = original.getTime();
    expect(toLocalDate(original)).not.toBe(original);
    expect(original.getTime()).toBe(timestamp);
  });

  it("preserves the recorded date of ISO strings rather than their UTC instant", () => {
    expect(normalizeDateOnly(toLocalDate("1999-02-05T00:00:00+14:00"))).toBe("1999-02-05");
    expect(normalizeDateOnly(toLocalDate("1999-02-05T23:00:00-12:00"))).toBe("1999-02-05");
  });

  it("returns undefined for invalid and empty dates", () => {
    expect(toLocalDate("1900-02-29")).toBeUndefined();
    expect(toLocalDate(null)).toBeUndefined();
  });

  it("does not invent today when the supplied clock is invalid", () => {
    expect(() => todayDateOnly(new Date(NaN))).toThrow(RangeError);
  });
});

describe("getDateInputFormat", () => {
  it.each([
    ["en-US", "MM/DD/YYYY", "02/05/1999", "2/5/1999", "1999-02-05"],
    ["en-GB", "DD/MM/YYYY", "05/02/1999", "5/2/1999", "1999-02-05"],
    ["es-ES", "DD/MM/YYYY", "05/02/1999", "5/2/1999", "1999-02-05"],
    ["fr-FR", "DD/MM/YYYY", "05/02/1999", "5/2/1999", "1999-02-05"],
    ["de-DE", "DD.MM.YYYY", "05.02.1999", "5.2.1999", "1999-02-05"],
    ["ja-JP", "YYYY/MM/DD", "1999/02/05", "1999/2/5", "1999-02-05"],
  ])("uses the %s date order and separator", (locale, hint, display, input, value) => {
    const dateFormat = getDateInputFormat(locale);
    expect(dateFormat.hint).toBe(hint);
    expect(dateFormat.format(value)).toBe(display);
    expect(dateFormat.parse(input)).toEqual({ kind: "valid", value });
    expect(dateFormat.parse(display)).toEqual({ kind: "valid", value });
    expect(dateFormat.parse(value)).toEqual({ kind: "valid", value });
  });

  it("does not guess a different locale when the input is ambiguous or invalid", () => {
    expect(getDateInputFormat("en-US").parse("2/5/1999")).toEqual({ kind: "valid", value: "1999-02-05" });
    expect(getDateInputFormat("en-GB").parse("2/5/1999")).toEqual({ kind: "valid", value: "1999-05-02" });
    expect(getDateInputFormat("en-US").parse("31/12/1999")).toEqual({ kind: "invalid" });
    expect(getDateInputFormat("en-US").parse("02.05.1999")).toEqual({ kind: "format" });
  });

  it.each(["", " ", "\u200f "])("recognizes empty input %s", (input) => {
    expect(getDateInputFormat("en-US").parse(input)).toEqual({ kind: "empty" });
  });

  it.each(["2", "2/", "2/5", "2/5/", "2/5/1", "2/5/19", "2/5/199", "1999", "1999-", "1999-0", "1999-02-", "1999-02-0"])("preserves incomplete input %s", (input) => {
    expect(getDateInputFormat("en-US").parse(input)).toEqual({ kind: "incomplete" });
  });

  it.each(["2/29/1900", "2/29/1999", "4/31/2000", "0/5/1999", "13/5/1999", "2/0/1999", "2/5/0000", "1900-02-29"])("rejects the impossible date %s", (input) => {
    expect(getDateInputFormat("en-US").parse(input)).toEqual({ kind: "invalid" });
  });

  it.each(["February 5, 1999", "2//1999", "2/5/19999", "2/5/1999extra", "02/05/1999T00:00:00Z", "1999-02-05T00:00:00Z", "2-5-99"])("reports an incorrect entry format for %s", (input) => {
    expect(getDateInputFormat("en-US").parse(input)).toEqual({ kind: "format" });
  });

  it("supports leap dates and four-digit ancient years in typed entry", () => {
    const dateFormat = getDateInputFormat("en-US");
    expect(dateFormat.parse("2/29/2000")).toEqual({ kind: "valid", value: "2000-02-29" });
    expect(dateFormat.parse("2/5/0099")).toEqual({ kind: "valid", value: "0099-02-05" });
    expect(dateFormat.format("0099-02-05")).toBe("02/05/0099");
  });

  it("formats legacy ISO dates without shifting time zones", () => {
    expect(getDateInputFormat("en-US").format("1999-02-05T00:00:00+14:00")).toBe("02/05/1999");
    expect(getDateInputFormat("en-GB").format("1999-02-05T23:30:00-12:00")).toBe("05/02/1999");
    expect(getDateInputFormat("en-US").format("1900-02-29")).toBe("");
  });

  it("accepts localized digits and ignores bidi marks and surrounding separator spaces", () => {
    const arabic = getDateInputFormat("ar-EG");
    expect(arabic.parse(arabic.format("1999-02-05"))).toEqual({ kind: "valid", value: "1999-02-05" });
    expect(arabic.parse("٠٥\u200f/٠٢\u200f/١٩٩٩")).toEqual({ kind: "valid", value: "1999-02-05" });
    expect(arabic.parse("1999-02-05")).toEqual({ kind: "valid", value: "1999-02-05" });
    expect(getDateInputFormat("en-GB").parse(" 5 / 2 / 1999 ")).toEqual({ kind: "valid", value: "1999-02-05" });
  });

  it("keeps date-only entry Gregorian even when the locale defaults to another calendar", () => {
    const thai = getDateInputFormat("th-TH");
    expect(thai.format("1999-02-05")).toContain("1999");
    expect(thai.parse(thai.format("1999-02-05"))).toEqual({ kind: "valid", value: "1999-02-05" });
  });

  it("falls back to an explicit safe locale for malformed locale preferences", () => {
    const dateFormat = getDateInputFormat("invalid_locale");
    expect(dateFormat.locale).toBe("en-US");
    expect(dateFormat.hint).toBe("MM/DD/YYYY");
  });
});

describe("validateDateOnly", () => {
  it("validates optional and required empty values separately", () => {
    for (const value of [null, undefined, "", " "]) {
      expect(validateDateOnly(value)).toBeNull();
      expect(validateDateOnly(value, { required: true })).toBe("required");
    }
    expect(validateDateOnly("1900-02-29", { required: true })).toBe("invalid");
  });

  it("uses inclusive date-only limits without timezone shifts", () => {
    const options = { min: "1999-02-05", max: "2000-02-29" };
    expect(validateDateOnly("1999-02-04", options)).toBe("min");
    expect(validateDateOnly("1999-02-05T00:00:00+14:00", options)).toBeNull();
    expect(validateDateOnly("2000-02-29T23:30:00-12:00", options)).toBeNull();
    expect(validateDateOnly("2000-03-01", options)).toBe("max");
    expect(validateDateOnly("1999-02-29", options)).toBe("invalid");
  });

  it("does not interpret invalid configuration dates as normalized boundaries", () => {
    expect(validateDateOnly("1999-02-05", { min: "invalid", max: "1900-02-29" })).toBeNull();
  });
});
