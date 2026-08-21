import {
  canonicalizeIsbn,
  extractIsbn,
  isValidIsbn13,
} from "./isbn.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
};

Deno.test("canonicalizes equivalent ISBN-10 and ISBN-13 values", () => {
  assertEquals(canonicalizeIsbn("0-306-40615-2"), "9780306406157");
  assertEquals(canonicalizeIsbn("978-0-306-40615-7"), "9780306406157");
});

Deno.test("rejects a valid EAN-13 that is not an ISBN", () => {
  assertEquals(isValidIsbn13("4006381333931"), false);
  assertEquals(canonicalizeIsbn("4006381333931"), null);
});

Deno.test("extracts a canonical ISBN from provider queries", () => {
  assertEquals(extractIsbn("isbn:0-306-40615-2"), "9780306406157");
  assertEquals(extractIsbn("scan 9780306406157"), "9780306406157");
});
