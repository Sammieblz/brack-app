export type RichTextFormat = "plain" | "tiptap";

export type RichTextJsonValue =
  | string
  | number
  | boolean
  | null
  | RichTextJsonObject
  | RichTextJsonValue[];

export interface RichTextJsonObject {
  [key: string]: RichTextJsonValue | undefined;
}

export interface RichTextDocument extends RichTextJsonObject {
  type: "doc";
  content?: RichTextJsonObject[];
}

export interface RichTextPayload {
  content_format: RichTextFormat;
  content_json: RichTextDocument | null;
  content_html: string | null;
  content: string;
}

const isRichTextJsonValue = (value: unknown): value is RichTextJsonValue => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isRichTextJsonValue);
  }

  return (
    typeof value === "object" &&
    Object.values(value).every(
      (nestedValue) => nestedValue === undefined || isRichTextJsonValue(nestedValue),
    )
  );
};

const isRichTextJsonObject = (value: unknown): value is RichTextJsonObject =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  isRichTextJsonValue(value);

export const parseRichTextDocument = (value: unknown): RichTextDocument | null => {
  if (!isRichTextJsonObject(value) || value.type !== "doc") return null;
  if (value.content === undefined) return { type: "doc" };
  if (!Array.isArray(value.content) || !value.content.every(isRichTextJsonObject)) return null;

  return {
    type: "doc",
    content: value.content,
  };
};

export const parseRichTextFormat = (value: unknown): RichTextFormat =>
  value === "tiptap" ? "tiptap" : "plain";
