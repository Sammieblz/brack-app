export interface RichTextPayload {
  content_format?: unknown;
  content_json?: unknown;
  content_html?: unknown;
}

export interface NormalizedRichText {
  content_format: "plain" | "tiptap";
  content_json: Record<string, unknown> | null;
  content_html: string | null;
  text: string;
}

const ALLOWED_NODES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "mention",
]);

const ALLOWED_MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link"]);

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeUrl = (url: unknown): string | null => {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) return null;
    return parsed.toString().slice(0, 1000);
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const textFromNode = (node: unknown): string => {
  if (!isRecord(node)) return "";
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (node.type === "hardBreak") return "\n";
  if (node.type === "mention" && isRecord(node.attrs)) {
    const label = typeof node.attrs.label === "string" ? node.attrs.label : "reader";
    return `@${label}`;
  }
  const children = Array.isArray(node.content) ? node.content : [];
  const joined = children.map(textFromNode).join("");
  if (["paragraph", "heading", "blockquote", "listItem"].includes(String(node.type))) {
    return `${joined}\n`;
  }
  return joined;
};

const validateNode = (node: unknown, depth = 0, count = { value: 0 }): void => {
  if (!isRecord(node)) throw new Error("Rich text node is invalid");
  if (depth > 24) throw new Error("Rich text is too deeply nested");
  count.value += 1;
  if (count.value > 1200) throw new Error("Rich text is too large");

  const type = typeof node.type === "string" ? node.type : "";
  if (!ALLOWED_NODES.has(type)) throw new Error(`Unsupported rich text node: ${type}`);

  if (Array.isArray(node.marks)) {
    for (const mark of node.marks) {
      if (!isRecord(mark) || typeof mark.type !== "string" || !ALLOWED_MARKS.has(mark.type)) {
        throw new Error("Unsupported rich text mark");
      }
      if (mark.type === "link" && (!isRecord(mark.attrs) || !safeUrl(mark.attrs.href))) {
        throw new Error("Unsupported rich text link");
      }
    }
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) validateNode(child, depth + 1, count);
  }
};

const applyMarks = (html: string, marks: unknown): string => {
  if (!Array.isArray(marks)) return html;
  return marks.reduce((acc, mark) => {
    if (!isRecord(mark) || typeof mark.type !== "string") return acc;
    switch (mark.type) {
      case "bold":
        return `<strong>${acc}</strong>`;
      case "italic":
        return `<em>${acc}</em>`;
      case "underline":
        return `<u>${acc}</u>`;
      case "strike":
        return `<s>${acc}</s>`;
      case "code":
        return `<code>${acc}</code>`;
      case "link": {
        const href = isRecord(mark.attrs) ? safeUrl(mark.attrs.href) : null;
        return href
          ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${acc}</a>`
          : acc;
      }
      default:
        return acc;
    }
  }, html);
};

const renderChildren = (node: Record<string, unknown>): string =>
  Array.isArray(node.content) ? node.content.map(renderNode).join("") : "";

const renderNode = (node: unknown): string => {
  if (!isRecord(node)) return "";
  const type = String(node.type || "");
  if (type === "text") {
    return applyMarks(escapeHtml(typeof node.text === "string" ? node.text : ""), node.marks);
  }
  if (type === "hardBreak") return "<br>";
  if (type === "mention") {
    const attrs = isRecord(node.attrs) ? node.attrs : {};
    const label = typeof attrs.label === "string" ? attrs.label : "reader";
    return `<span data-mention="true">@${escapeHtml(label)}</span>`;
  }
  const children = renderChildren(node);
  if (type === "doc") return children;
  if (type === "paragraph") return `<p>${children}</p>`;
  if (type === "heading") {
    const attrs = isRecord(node.attrs) ? node.attrs : {};
    const level = Math.min(Math.max(Number(attrs.level || 2), 1), 3);
    return `<h${level}>${children}</h${level}>`;
  }
  if (type === "bulletList") return `<ul>${children}</ul>`;
  if (type === "orderedList") return `<ol>${children}</ol>`;
  if (type === "listItem") return `<li>${children}</li>`;
  if (type === "blockquote") return `<blockquote>${children}</blockquote>`;
  if (type === "codeBlock") return `<pre><code>${children}</code></pre>`;
  return "";
};

export const normalizeRichText = (
  payload: RichTextPayload | null | undefined,
  fallbackContent: unknown,
  maxTextLength = 5000,
): NormalizedRichText => {
  const fallbackText = typeof fallbackContent === "string" ? fallbackContent.trim().slice(0, maxTextLength) : "";
  if (!payload || payload.content_format !== "tiptap" || !isRecord(payload.content_json)) {
    return {
      content_format: "plain",
      content_json: null,
      content_html: null,
      text: fallbackText,
    };
  }

  validateNode(payload.content_json);
  const text = textFromNode(payload.content_json).replace(/\n{3,}/g, "\n\n").trim().slice(0, maxTextLength);
  if (!text) throw new Error("Rich text content is empty");

  return {
    content_format: "tiptap",
    content_json: payload.content_json,
    content_html: renderNode(payload.content_json).slice(0, maxTextLength * 12),
    text,
  };
};
