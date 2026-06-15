import DOMPurify from "dompurify";
import type { RichTextDocument, RichTextPayload } from "@/types/richText";

const SAFE_LINK_PATTERN = /^(https?:|mailto:)/i;

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "span",
];

const ALLOWED_ATTR = ["href", "target", "rel", "data-mention"];

const textFromNode = (node: unknown): string => {
  if (!node || typeof node !== "object" || Array.isArray(node)) return "";
  const record = node as Record<string, unknown>;
  if (record.type === "text" && typeof record.text === "string") return record.text;
  if (record.type === "hardBreak") return "\n";
  if (record.type === "mention" && record.attrs && typeof record.attrs === "object") {
    const attrs = record.attrs as Record<string, unknown>;
    return `@${typeof attrs.label === "string" ? attrs.label : "reader"}`;
  }
  const children = Array.isArray(record.content) ? record.content : [];
  const text = children.map(textFromNode).join("");
  if (["paragraph", "heading", "blockquote", "listItem"].includes(String(record.type))) {
    return `${text}\n`;
  }
  return text;
};

export const richTextToPlainText = (doc: RichTextDocument | null | undefined): string =>
  doc ? textFromNode(doc).replace(/\n{3,}/g, "\n\n").trim() : "";

export const sanitizeRichTextHtml = (html: string | null | undefined): string =>
  DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
  });

export const isSafeRichTextUrl = (url: unknown): url is string =>
  typeof url === "string" && SAFE_LINK_PATTERN.test(url.trim());

export const toPlainRichTextPayload = (content: string): RichTextPayload => ({
  content_format: "plain",
  content_json: null,
  content_html: null,
  content,
});
