const collectMatches = (value: string, pattern: RegExp, group: number) =>
  Array.from(value.matchAll(pattern), (match) => match[group]).filter(
    (candidate): candidate is string => Boolean(candidate)
  );

export const normalizeIsbn = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .replace(/^urn:isbn:/i, "")
    .replace(/[^0-9Xx]/g, "")
    .toUpperCase();

export const isValidIsbn10 = (value: string) => {
  const isbn = normalizeIsbn(value);
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;

  const total = isbn.split("").reduce((sum, character, index) => {
    const digit = character === "X" ? 10 : Number(character);
    return sum + digit * (10 - index);
  }, 0);

  return total % 11 === 0;
};

export const isValidIsbn13 = (value: string) => {
  const isbn = normalizeIsbn(value);
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  const total = isbn
    .slice(0, 12)
    .split("")
    .reduce((sum, character, index) => sum + Number(character) * (index % 2 === 0 ? 1 : 3), 0);
  const expectedCheckDigit = (10 - (total % 10)) % 10;
  return expectedCheckDigit === Number(isbn[12]);
};

export const isValidIsbn = (value: string) => {
  const isbn = normalizeIsbn(value);
  return isbn.length === 10 ? isValidIsbn10(isbn) : isValidIsbn13(isbn);
};

export const isbn10To13 = (value: string) => {
  const isbn10 = normalizeIsbn(value);
  if (!isValidIsbn10(isbn10)) return null;
  const body = `978${isbn10.slice(0, 9)}`;
  const total = body
    .split("")
    .reduce((sum, character, index) => sum + Number(character) * (index % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - (total % 10)) % 10}`;
};

export const canonicalizeIsbn = (value: string) => {
  const normalized = normalizeIsbn(value);
  if (isValidIsbn13(normalized)) return normalized;
  if (isValidIsbn10(normalized)) return isbn10To13(normalized);
  return null;
};

export const extractIsbnFromScan = (rawValue: string) => {
  const trimmed = rawValue.trim();
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    // Some QR payloads contain a literal "%" that is not URL encoded.
  }

  const candidates = [
    decoded,
    ...collectMatches(decoded, /(^|[^0-9])(97[89]\d{10})(?!\d)/g, 2),
    ...collectMatches(decoded, /(^|[^0-9])(\d{9}[\dXx])(?![0-9Xx])/g, 2),
    ...collectMatches(
      decoded,
      /(^|[^0-9Xx])([0-9Xx](?:[0-9Xx -]{8,28})[0-9Xx])(?![0-9Xx])/g,
      2
    ),
  ];

  for (const candidate of candidates) {
    const isbn = canonicalizeIsbn(candidate);
    if (isbn) return isbn;
  }
  return null;
};

export const buildIsbnSearchQuery = (isbn: string) => `isbn:${canonicalizeIsbn(isbn) ?? isbn}`;
