import { describe, expect, it } from "vitest";
import { decryptBackup, encryptBackup, parseReadingImport } from "./dataPortability";

describe("reading backup encryption", () => {
  it("round-trips an AES-GCM encrypted archive", async () => {
    const source = new TextEncoder().encode("brack backup payload");
    const encrypted = await encryptBackup(source, "correct horse battery staple");
    const decrypted = await decryptBackup(encrypted, "correct horse battery staple");
    expect(new TextDecoder().decode(decrypted)).toBe("brack backup payload");
  });

  it("rejects the wrong passphrase", async () => {
    const encrypted = await encryptBackup(
      new TextEncoder().encode("private"),
      "correct-passphrase"
    );
    await expect(decryptBackup(encrypted, "incorrect-passphrase")).rejects.toThrow(
      "Incorrect passphrase"
    );
  });
});

describe("CSV import parsing", () => {
  it("recognizes Goodreads CSV and normalizes reading state", async () => {
    const csv = [
      "Book Id,Title,Author,ISBN13,Exclusive Shelf,My Rating,Number of Pages",
      '123,Kindred,Octavia E. Butler,"9780807083697",read,5,288',
    ].join("\n");
    const file = {
      name: "goodreads_library_export.csv",
      arrayBuffer: async () => new TextEncoder().encode(csv).buffer,
    } as File;
    const parsed = await parseReadingImport(file);
    expect(parsed.sourceFormat).toBe("goodreads_csv");
    expect(parsed.payload.books[0]).toMatchObject({
      title: "Kindred",
      author: "Octavia E. Butler",
      isbn: "9780807083697",
      status: "completed",
      rating: 5,
      pages: 288,
    });
  });
});
