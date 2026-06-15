export type RichTextFormat = "plain" | "tiptap";

export interface RichTextDocument {
  type: "doc";
  content?: Array<Record<string, unknown>>;
}

export interface RichTextPayload {
  content_format: RichTextFormat;
  content_json: RichTextDocument | null;
  content_html: string | null;
  content: string;
}
