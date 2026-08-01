export const normalizeIsbn = (value: string) =>
  value.toUpperCase().replace(/[^0-9X]/g, "");

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
    .reduce(
      (sum, character, index) =>
        sum + Number(character) * (index % 2 === 0 ? 1 : 3),
      0,
    );
  return (10 - (total % 10)) % 10 === Number(isbn[12]);
};

export const canonicalizeIsbn = (value: string) => {
  const isbn = normalizeIsbn(value);
  if (isValidIsbn13(isbn)) return isbn;
  if (!isValidIsbn10(isbn)) return null;

  const body = `978${isbn.slice(0, 9)}`;
  const total = body
    .split("")
    .reduce(
      (sum, character, index) =>
        sum + Number(character) * (index % 2 === 0 ? 1 : 3),
      0,
    );
  return `${body}${(10 - (total % 10)) % 10}`;
};

export const extractIsbn = (query: string) => {
  const direct = canonicalizeIsbn(query.replace(/^isbn:/i, ""));
  if (direct) return direct;

  const candidates = [
    ...(query.match(/97[89][\d\s-]{10,20}\d/g) ?? []),
    ...(query.match(/\d[\d\s-]{8,16}[\dX](?![\dX])/gi) ?? []),
  ];
  for (const candidate of candidates) {
    const isbn = canonicalizeIsbn(candidate);
    if (isbn) return isbn;
  }
  return null;
};
